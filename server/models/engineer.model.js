// server/models/engineer.model.js
// All DB interactions for the Engineering Toolkit module.
// Uses snake_case keys throughout (§6.0 wire format). Every per-user query is
// scoped by user_id; ownership of a project is verified before nested writes.

import pool from '../lib/db.js';

// ──────────────────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────────────────

const PROJECT_SORT = ['created_at', 'updated_at', 'name', 'status', 'project_type'];

/**
 * List a user's projects with optional type/status filters and pagination.
 * @param {number} userId
 * @param {{ project_type?: string, status?: string, page?: number, per_page?: number, sort?: string, order?: string }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
export async function listProjects(userId, opts = {}) {
  const {
    project_type, status,
    page = 1, per_page = 20,
    sort = 'updated_at', order = 'desc',
  } = opts;

  const safeSort = PROJECT_SORT.includes(sort) ? sort : 'updated_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['user_id = $1'];
  const params = [userId];
  let i = 2;

  if (project_type) { conditions.push(`project_type = $${i++}`); params.push(project_type); }
  if (status)       { conditions.push(`status = $${i++}`);       params.push(status); }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * per_page;

  const countResult = await pool.query(`SELECT COUNT(*) FROM engineer_projects WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(
    `SELECT * FROM engineer_projects
     WHERE ${where}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, per_page, offset]
  );

  return { rows: dataResult.rows, total };
}

/**
 * Get one project, scoped to the user.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getProjectById(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM engineer_projects WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create a project.
 * @param {number} userId
 * @param {{ name: string, description?: string, project_type?: string, platforms?: string, stack?: string, status?: string, repo_url?: string }} data
 * @returns {Promise<object>}
 */
export async function createProject(userId, data) {
  const { name, description, project_type, platforms, stack, status, repo_url } = data;
  const { rows } = await pool.query(
    `INSERT INTO engineer_projects
       (user_id, name, description, project_type, platforms, stack, status, repo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      name,
      description ?? null,
      project_type ?? 'other',
      platforms ?? null,
      stack ?? null,
      status ?? 'idea',
      repo_url ?? null,
    ]
  );
  return rows[0];
}

/**
 * Partial update (PATCH) a project.
 * @param {number} id
 * @param {number} userId
 * @param {Object} patch
 * @returns {Promise<object|null>}
 */
export async function patchProject(id, userId, patch) {
  const allowed = ['name', 'description', 'project_type', 'platforms', 'stack', 'status', 'repo_url'];
  const fields = Object.keys(patch).filter(k => allowed.includes(k));
  if (fields.length === 0) return getProjectById(id, userId);

  const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => patch[f]);

  const { rows } = await pool.query(
    `UPDATE engineer_projects SET ${setClauses}
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Delete a project (cascades to its documents, check-ins, and issues).
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteProject(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM engineer_projects WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

/**
 * Summary stats for the projects landing page.
 * @param {number} userId
 * @returns {Promise<{ total: number, active: number, deployed: number, idea: number }>}
 */
export async function getProjectStats(userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                                           AS total,
       COUNT(*) FILTER (WHERE status IN ('planning','development','testing')) AS active,
       COUNT(*) FILTER (WHERE status = 'deployed')                        AS deployed,
       COUNT(*) FILTER (WHERE status = 'idea')                            AS idea
     FROM engineer_projects
     WHERE user_id = $1`,
    [userId]
  );
  const r = rows[0];
  return {
    total:    parseInt(r.total, 10),
    active:   parseInt(r.active, 10),
    deployed: parseInt(r.deployed, 10),
    idea:     parseInt(r.idea, 10),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Templates (global)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List all scaffolding templates (global, not user-scoped).
 * @returns {Promise<object[]>}
 */
export async function listTemplates() {
  const { rows } = await pool.query(
    `SELECT id, name, description, domain, folder_structure, doc_templates, created_at
     FROM engineer_templates
     ORDER BY domain, name`
  );
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────────
// Snippets
// ──────────────────────────────────────────────────────────────────────────────

const SNIPPET_SORT = ['created_at', 'updated_at', 'title', 'category', 'language'];

// Starter snippet library seeded lazily per user on first snippet read (mirrors
// the finance ensureDefaults / roadmap seed pattern, because snippets are
// user-scoped and cannot be seeded globally in the migration). 16 snippets
// spanning the suggested categories and supported languages.
const STARTER_SNIPPETS = [
  {
    title: 'Debounced button read (Arduino)',
    category: 'Utility', language: 'cpp', tags: 'gpio, button, debounce, arduino',
    code: `const uint8_t BTN = 4;\nuint32_t lastEdge = 0;\nint lastState = HIGH;\n\nbool pressed() {\n  int s = digitalRead(BTN);\n  if (s != lastState && millis() - lastEdge > 30) {\n    lastEdge = millis();\n    lastState = s;\n    return s == LOW;\n  }\n  return false;\n}`,
  },
  {
    title: 'I2C scanner',
    category: 'Communication', language: 'cpp', tags: 'i2c, wire, scan, esp32',
    code: `#include <Wire.h>\n\nvoid setup() {\n  Wire.begin();\n  Serial.begin(115200);\n  for (uint8_t a = 1; a < 127; a++) {\n    Wire.beginTransmission(a);\n    if (Wire.endTransmission() == 0)\n      Serial.printf("Found 0x%02X\\n", a);\n  }\n}\n\nvoid loop() {}`,
  },
  {
    title: 'SPI full-duplex transfer',
    category: 'Communication', language: 'cpp', tags: 'spi, transfer, arduino',
    code: `#include <SPI.h>\n\nuint8_t xfer(uint8_t reg, uint8_t val) {\n  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));\n  digitalWrite(SS, LOW);\n  SPI.transfer(reg);\n  uint8_t r = SPI.transfer(val);\n  digitalWrite(SS, HIGH);\n  SPI.endTransaction();\n  return r;\n}`,
  },
  {
    title: 'Moving-average filter',
    category: 'Filtering / DSP', language: 'cpp', tags: 'filter, smoothing, adc',
    code: `template <uint8_t N>\nclass MovingAverage {\n  int32_t buf[N] = {0};\n  uint8_t i = 0;\n  int32_t sum = 0;\npublic:\n  int32_t push(int32_t x) {\n    sum -= buf[i];\n    buf[i] = x;\n    sum += x;\n    i = (i + 1) % N;\n    return sum / N;\n  }\n};`,
  },
  {
    title: 'FreeRTOS task + queue',
    category: 'RTOS', language: 'c', tags: 'freertos, task, queue',
    code: `static QueueHandle_t q;\n\nstatic void producer(void *arg) {\n  int v = 0;\n  for (;;) { xQueueSend(q, &v, portMAX_DELAY); v++; vTaskDelay(pdMS_TO_TICKS(100)); }\n}\nstatic void consumer(void *arg) {\n  int v;\n  for (;;) if (xQueueReceive(q, &v, portMAX_DELAY)) printf("got %d\\n", v);\n}\n\nvoid app_main(void) {\n  q = xQueueCreate(8, sizeof(int));\n  xTaskCreate(producer, "prod", 2048, NULL, 5, NULL);\n  xTaskCreate(consumer, "cons", 2048, NULL, 5, NULL);\n}`,
  },
  {
    title: 'ESP32 deep sleep with timer wake',
    category: 'Power Management', language: 'cpp', tags: 'esp32, sleep, lowpower',
    code: `#define uS_PER_S 1000000ULL\n#define SLEEP_S 60\n\nvoid setup() {\n  Serial.begin(115200);\n  // ... do work, then sleep\n  esp_sleep_enable_timer_wakeup(SLEEP_S * uS_PER_S);\n  Serial.println("Sleeping...");\n  esp_deep_sleep_start();\n}\n\nvoid loop() {}`,
  },
  {
    title: 'PID controller',
    category: 'Motor Control', language: 'cpp', tags: 'pid, control, motor',
    code: `struct PID {\n  float kp, ki, kd, integ = 0, prev = 0;\n  float step(float setpoint, float measured, float dt) {\n    float e = setpoint - measured;\n    integ += e * dt;\n    float deriv = (e - prev) / dt;\n    prev = e;\n    return kp * e + ki * integ + kd * deriv;\n  }\n};`,
  },
  {
    title: 'MQTT publish (PubSubClient)',
    category: 'Networking', language: 'cpp', tags: 'mqtt, wifi, esp32, telemetry',
    code: `#include <PubSubClient.h>\n#include <WiFiClient.h>\n\nWiFiClient net;\nPubSubClient mqtt(net);\n\nvoid publishTemp(float t) {\n  if (!mqtt.connected()) mqtt.connect("node-1");\n  char payload[32];\n  snprintf(payload, sizeof(payload), "{\\"temp\\":%.2f}", t);\n  mqtt.publish("sensors/temp", payload);\n}`,
  },
  {
    title: 'LoRa uplink (RadioLib)',
    category: 'Communication', language: 'cpp', tags: 'lora, radiolib, heltec',
    code: `#include <RadioLib.h>\n\nSX1262 radio = new Module(8, 14, 12, 13);\n\nvoid sendUplink(const char *msg) {\n  int state = radio.transmit(msg);\n  if (state == RADIOLIB_ERR_NONE) Serial.println("uplink ok");\n  else Serial.printf("uplink failed: %d\\n", state);\n}`,
  },
  {
    title: 'picamera2 capture loop',
    category: 'Vision', language: 'python', tags: 'raspberrypi, camera, picamera2',
    code: `from picamera2 import Picamera2\nimport time\n\npicam2 = Picamera2()\npicam2.configure(picam2.create_still_configuration())\npicam2.start()\n\ntry:\n    while True:\n        picam2.capture_file("frame.jpg")\n        time.sleep(5)\nfinally:\n    picam2.stop()`,
  },
  {
    title: 'OpenCV grayscale + threshold',
    category: 'Vision', language: 'python', tags: 'opencv, vision, preprocessing',
    code: `import cv2\n\ndef preprocess(path):\n    img = cv2.imread(path)\n    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)\n    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)\n    return thresh`,
  },
  {
    title: 'ROS2 minimal publisher',
    category: 'Communication', language: 'python', tags: 'ros2, rclpy, publisher',
    code: `import rclpy\nfrom rclpy.node import Node\nfrom std_msgs.msg import String\n\nclass Talker(Node):\n    def __init__(self):\n        super().__init__('talker')\n        self.pub = self.create_publisher(String, 'chatter', 10)\n        self.create_timer(0.5, self.tick)\n\n    def tick(self):\n        m = String(); m.data = 'hello'\n        self.pub.publish(m)\n\ndef main():\n    rclpy.init(); rclpy.spin(Talker()); rclpy.shutdown()`,
  },
  {
    title: 'Serial read loop (pyserial)',
    category: 'Utility', language: 'python', tags: 'serial, pyserial, host',
    code: `import serial\n\nwith serial.Serial('/dev/ttyUSB0', 115200, timeout=1) as ser:\n    while True:\n        line = ser.readline().decode(errors='ignore').strip()\n        if line:\n            print(line)`,
  },
  {
    title: 'PlatformIO env (Heltec V3)',
    category: 'Config', language: 'ini', tags: 'platformio, esp32, config',
    code: `[env:heltec_wifi_lora_32_V3]\nplatform = espressif32\nboard = heltec_wifi_lora_32_V3\nframework = arduino\nmonitor_speed = 115200\nlib_deps =\n  jgromes/RadioLib\n  bblanchon/ArduinoJson`,
  },
  {
    title: 'GitHub Actions: PlatformIO CI',
    category: 'Config', language: 'yaml', tags: 'ci, github-actions, platformio',
    code: `name: PlatformIO CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with: { python-version: '3.x' }\n      - run: pip install platformio\n      - run: pio run`,
  },
  {
    title: 'Flash firmware (st-flash)',
    category: 'Utility', language: 'bash', tags: 'stm32, flash, build',
    code: `#!/usr/bin/env bash\nset -euo pipefail\nmake -j"$(nproc)"\nst-flash write build/firmware.bin 0x8000000\necho "flashed"`,
  },
];

/**
 * Idempotently seed a user's starter snippet library on first read. Guarded by a
 * fast existence check so it only runs once per user. Mirrors the finance
 * ensureDefaults() / roadmap seed pattern.
 * @param {number} userId
 */
export async function seedSnippetsForUser(userId) {
  const existing = await pool.query(
    'SELECT 1 FROM engineer_snippets WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (existing.rowCount > 0) return;

  await pool.query(
    `INSERT INTO engineer_snippets (user_id, title, category, language, tags, code)
     SELECT $1, x.title, x.category, x.language, x.tags, x.code
     FROM jsonb_to_recordset($2::jsonb)
       AS x(title text, category text, language text, tags text, code text)`,
    [userId, JSON.stringify(STARTER_SNIPPETS)]
  );
}

/**
 * List a user's snippets with optional search (title/tags/code), category and
 * language filters, and pagination.
 * @param {number} userId
 * @param {{ q?: string, category?: string, language?: string, page?: number, per_page?: number, sort?: string, order?: string }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
export async function listSnippets(userId, opts = {}) {
  const {
    q, category, language,
    page = 1, per_page = 50,
    sort = 'updated_at', order = 'desc',
  } = opts;

  await seedSnippetsForUser(userId);

  const safeSort = SNIPPET_SORT.includes(sort) ? sort : 'updated_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['user_id = $1'];
  const params = [userId];
  let i = 2;

  if (q) {
    conditions.push(`(title ILIKE $${i} OR tags ILIKE $${i} OR code ILIKE $${i})`);
    params.push(`%${q}%`);
    i++;
  }
  if (category) { conditions.push(`category = $${i++}`); params.push(category); }
  if (language) { conditions.push(`language = $${i++}`); params.push(language); }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * per_page;

  const countResult = await pool.query(`SELECT COUNT(*) FROM engineer_snippets WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(
    `SELECT * FROM engineer_snippets
     WHERE ${where}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, per_page, offset]
  );

  return { rows: dataResult.rows, total };
}

/**
 * Get one snippet, scoped to the user.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getSnippetById(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM engineer_snippets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create a snippet.
 * @param {number} userId
 * @param {{ title: string, category: string, language?: string, tags?: string, code: string }} data
 * @returns {Promise<object>}
 */
export async function createSnippet(userId, data) {
  const { title, category, language, tags, code } = data;
  const { rows } = await pool.query(
    `INSERT INTO engineer_snippets (user_id, title, category, language, tags, code)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, title, category, language ?? 'cpp', tags ?? null, code]
  );
  return rows[0];
}

/**
 * Partial update (PATCH) a snippet.
 * @param {number} id
 * @param {number} userId
 * @param {Object} patch
 * @returns {Promise<object|null>}
 */
export async function patchSnippet(id, userId, patch) {
  const allowed = ['title', 'category', 'language', 'tags', 'code'];
  const fields = Object.keys(patch).filter(k => allowed.includes(k));
  if (fields.length === 0) return getSnippetById(id, userId);

  const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => patch[f]);

  const { rows } = await pool.query(
    `UPDATE engineer_snippets SET ${setClauses}
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Delete a snippet.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteSnippet(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM engineer_snippets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Documents (optionally scoped to a project)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List documents for a specific project, scoped to the user.
 * @param {number} projectId
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
export async function listProjectDocuments(projectId, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM engineer_documents
     WHERE project_id = $1 AND user_id = $2
     ORDER BY updated_at DESC`,
    [projectId, userId]
  );
  return rows;
}

/**
 * List a user's global documents (project_id IS NULL).
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
export async function listGlobalDocuments(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM engineer_documents
     WHERE user_id = $1 AND project_id IS NULL
     ORDER BY updated_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Get one document, scoped to the user.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getDocumentById(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM engineer_documents WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create a document. `projectId` may be null for a global document.
 * @param {number} userId
 * @param {number|null} projectId
 * @param {{ title: string, content?: string, doc_type?: string }} data
 * @returns {Promise<object>}
 */
export async function createDocument(userId, projectId, data) {
  const { title, content, doc_type } = data;
  const { rows } = await pool.query(
    `INSERT INTO engineer_documents (user_id, project_id, title, content, doc_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, projectId ?? null, title, content ?? null, doc_type ?? null]
  );
  return rows[0];
}

/**
 * Partial update (PATCH) a document.
 * @param {number} id
 * @param {number} userId
 * @param {Object} patch
 * @returns {Promise<object|null>}
 */
export async function patchDocument(id, userId, patch) {
  const allowed = ['title', 'content', 'doc_type'];
  const fields = Object.keys(patch).filter(k => allowed.includes(k));
  if (fields.length === 0) return getDocumentById(id, userId);

  const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => patch[f]);

  const { rows } = await pool.query(
    `UPDATE engineer_documents SET ${setClauses}
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Delete a document.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteDocument(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM engineer_documents WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Check-ins (per project)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List check-ins for a project, scoped to the user, newest week first.
 * @param {number} projectId
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
export async function listCheckins(projectId, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM engineer_checkins
     WHERE project_id = $1 AND user_id = $2
     ORDER BY week_start DESC, created_at DESC`,
    [projectId, userId]
  );
  return rows;
}

/**
 * Create a check-in for a project.
 * @param {number} userId
 * @param {number} projectId
 * @param {{ week_start: string, achievements?: string, plans_next?: string, blockers?: string, bugs_discovered?: string, concerns?: string }} data
 * @returns {Promise<object>}
 */
export async function createCheckin(userId, projectId, data) {
  const { week_start, achievements, plans_next, blockers, bugs_discovered, concerns } = data;
  const { rows } = await pool.query(
    `INSERT INTO engineer_checkins
       (user_id, project_id, week_start, achievements, plans_next, blockers, bugs_discovered, concerns)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId, projectId, week_start,
      achievements ?? null, plans_next ?? null, blockers ?? null,
      bugs_discovered ?? null, concerns ?? null,
    ]
  );
  return rows[0];
}

// ──────────────────────────────────────────────────────────────────────────────
// Issues (per project)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List issues for a project with optional status/severity filters.
 * @param {number} projectId
 * @param {number} userId
 * @param {{ status?: string, severity?: string }} opts
 * @returns {Promise<object[]>}
 */
export async function listIssues(projectId, userId, opts = {}) {
  const { status, severity } = opts;
  const conditions = ['project_id = $1', 'user_id = $2'];
  const params = [projectId, userId];
  let i = 3;

  if (status)   { conditions.push(`status = $${i}`);   params.push(status);   i++; }
  if (severity) { conditions.push(`severity = $${i}`); params.push(severity); }

  const { rows } = await pool.query(
    `SELECT * FROM engineer_issues
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       array_position(ARRAY['P0-Critical','P1-High','P2-Medium','P3-Low']::text[], severity),
       created_at DESC`,
    params
  );
  return rows;
}

/**
 * Get one issue, scoped to the user.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getIssueById(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM engineer_issues WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create an issue for a project.
 * @param {number} userId
 * @param {number} projectId
 * @param {{ title: string, description?: string, severity?: string, status?: string, component?: string, assignee?: string }} data
 * @returns {Promise<object>}
 */
export async function createIssue(userId, projectId, data) {
  const { title, description, severity, status, component, assignee } = data;
  const { rows } = await pool.query(
    `INSERT INTO engineer_issues
       (user_id, project_id, title, description, severity, status, component, assignee)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId, projectId, title,
      description ?? null,
      severity ?? 'P2-Medium',
      status ?? 'open',
      component ?? null,
      assignee ?? null,
    ]
  );
  return rows[0];
}

/**
 * Partial update (PATCH) an issue.
 * @param {number} id
 * @param {number} userId
 * @param {Object} patch
 * @returns {Promise<object|null>}
 */
export async function patchIssue(id, userId, patch) {
  const allowed = ['title', 'description', 'severity', 'status', 'component', 'assignee'];
  const fields = Object.keys(patch).filter(k => allowed.includes(k));
  if (fields.length === 0) return getIssueById(id, userId);

  const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => patch[f]);

  const { rows } = await pool.query(
    `UPDATE engineer_issues SET ${setClauses}
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Delete an issue.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteIssue(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM engineer_issues WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Roadmap (global months + per-user skill checklist)
// ──────────────────────────────────────────────────────────────────────────────

// Per-user skill seed. The 12 months are inserted globally by the migration;
// the per-user checklist below is seeded lazily the first time a user opens the
// roadmap (mirrors finance ensureDefaults). Keyed by month_number.
const ROADMAP_SKILL_SEED = {
  1:  [
    { category: 'hardware', title: 'Wire a breadboard power rail and verify with a multimeter' },
    { category: 'software', title: 'Set up the toolchain and flash a blink to one board' },
    { category: 'process',  title: 'Initialise a git repo with a sensible .gitignore' },
  ],
  2:  [
    { category: 'hardware', title: 'Drive an LED and read a debounced button' },
    { category: 'software', title: 'Handle a GPIO interrupt and a hardware timer' },
    { category: 'process',  title: 'Write a one-page design note for the I/O map' },
  ],
  3:  [
    { category: 'hardware', title: 'Connect an I2C sensor and an SPI display' },
    { category: 'software', title: 'Implement UART, I2C, and SPI reads' },
    { category: 'process',  title: 'Capture a bus trace with a logic analyzer' },
  ],
  4:  [
    { category: 'hardware', title: 'Build an analog front-end (divider + RC filter)' },
    { category: 'software', title: 'Sample the ADC and apply a moving-average filter' },
    { category: 'process',  title: 'Calibrate a sensor against a known reference' },
  ],
  5:  [
    { category: 'hardware', title: 'Reproduce a timing bug caused by a blocking delay' },
    { category: 'software', title: 'Split work into FreeRTOS tasks with a queue' },
    { category: 'process',  title: 'Document task priorities and stack sizing' },
  ],
  6:  [
    { category: 'hardware', title: 'Bring up a WiFi/LoRa/BLE radio module' },
    { category: 'software', title: 'Publish telemetry over MQTT or a LoRa uplink' },
    { category: 'process',  title: 'Define the message schema and topics' },
  ],
  7:  [
    { category: 'hardware', title: 'Measure sleep vs active current draw' },
    { category: 'software', title: 'Implement deep sleep with timed wake' },
    { category: 'process',  title: 'Produce a battery-life budget estimate' },
  ],
  8:  [
    { category: 'hardware', title: 'Pick parts and assign footprints for a 2-layer board' },
    { category: 'software', title: 'Capture the schematic and route the PCB' },
    { category: 'process',  title: 'Export and sanity-check Gerber fab files' },
  ],
  9:  [
    { category: 'hardware', title: 'Wire a motor driver with encoder feedback' },
    { category: 'software', title: 'Tune a PID loop for position or speed' },
    { category: 'process',  title: 'Derive and document forward kinematics' },
  ],
  10: [
    { category: 'hardware', title: 'Interface one sensor and one actuator to a host' },
    { category: 'software', title: 'Write a ROS2 publisher, subscriber, and launch file' },
    { category: 'process',  title: 'Diagram the node/topic graph' },
  ],
  11: [
    { category: 'hardware', title: 'Mount and focus a camera on a Pi-class board' },
    { category: 'software', title: 'Run a lightweight inference model on captured frames' },
    { category: 'process',  title: 'Benchmark FPS and latency on-device' },
  ],
  12: [
    { category: 'hardware', title: 'Design or print a field-ready enclosure' },
    { category: 'software', title: 'Add OTA updates, a watchdog, and structured logging' },
    { category: 'process',  title: 'Write a deployment runbook and reliability checklist' },
  ],
};

/**
 * Idempotently seed the per-user roadmap skill checklist. Safe to call on every
 * roadmap read — only inserts rows for (month, category, title) tuples the user
 * does not already have. Mirrors the finance ensureDefaults() pattern.
 * @param {number} userId
 */
export async function seedRoadmapSkillsForUser(userId) {
  // Fast path: if the user already has any skills, assume seeding is done.
  const existing = await pool.query(
    'SELECT 1 FROM engineer_roadmap_skills WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (existing.rowCount > 0) return;

  const months = await pool.query('SELECT id, month_number FROM engineer_roadmap_months');
  if (months.rowCount === 0) return; // months not seeded yet (should not happen post-migration)

  // Build a flat list of { month_id, category, title } from the seed map.
  const records = [];
  for (const { id: monthId, month_number } of months.rows) {
    const skills = ROADMAP_SKILL_SEED[month_number] ?? [];
    for (const s of skills) {
      records.push({ month_id: monthId, category: s.category, title: s.title });
    }
  }
  if (records.length === 0) return;

  await pool.query(
    `INSERT INTO engineer_roadmap_skills (user_id, month_id, category, title)
     SELECT $1, x.month_id, x.category, x.title
     FROM jsonb_to_recordset($2::jsonb) AS x(month_id int, category text, title text)`,
    [userId, JSON.stringify(records)]
  );
}

/**
 * Return all roadmap months with the calling user's skill checklist nested under
 * each. Lazily seeds the user's skills on first call.
 * @param {number} userId
 * @returns {Promise<object[]>} months ordered by month_number, each with a `skills` array
 */
export async function getRoadmap(userId) {
  await seedRoadmapSkillsForUser(userId);

  const monthsResult = await pool.query(
    `SELECT id, month_number, title, description
     FROM engineer_roadmap_months
     ORDER BY month_number`
  );

  const skillsResult = await pool.query(
    `SELECT id, month_id, category, title, completed
     FROM engineer_roadmap_skills
     WHERE user_id = $1
     ORDER BY array_position(ARRAY['hardware','software','process']::text[], category), id`,
    [userId]
  );

  const byMonth = new Map();
  for (const s of skillsResult.rows) {
    if (!byMonth.has(s.month_id)) byMonth.set(s.month_id, []);
    byMonth.get(s.month_id).push(s);
  }

  return monthsResult.rows.map(m => ({
    ...m,
    skills: byMonth.get(m.id) ?? [],
  }));
}

/**
 * Get one roadmap skill, scoped to the user.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getRoadmapSkillById(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM engineer_roadmap_skills WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * Set the `completed` flag on a single roadmap skill.
 * @param {number} id
 * @param {number} userId
 * @param {boolean} completed
 * @returns {Promise<object|null>}
 */
export async function setRoadmapSkillCompleted(id, userId, completed) {
  const { rows } = await pool.query(
    `UPDATE engineer_roadmap_skills SET completed = $3
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, completed]
  );
  return rows[0] ?? null;
}
