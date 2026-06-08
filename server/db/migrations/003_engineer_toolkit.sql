-- Migration: 003_engineer_toolkit
-- Adds the Engineering Toolkit module: projects, reusable scaffolding templates,
-- code snippets, project documents, weekly check-ins, issues, and a 12-month
-- skills roadmap.
--
-- Creates 8 tables, all following §6.5 conventions:
--   SERIAL PK, user_id FK ON DELETE CASCADE (except the two global tables),
--   VARCHAR enums (CHECK, never ENUM type), TIMESTAMPTZ, shared set_updated_at()
--   trigger on every table that has updated_at, and idx_{table}_{col} indexes.
--
--   engineer_projects        — per-user projects (IoT / embedded / robotics / other)
--   engineer_templates       — GLOBAL scaffolding templates (no user_id)
--   engineer_snippets        — per-user code snippets, syntax-highlighted in the UI
--   engineer_documents       — per-user docs, optionally scoped to a project
--   engineer_checkins        — per-project weekly check-ins
--   engineer_issues          — per-project issue tracker
--   engineer_roadmap_months  — GLOBAL 12-month roadmap definition (no user_id)
--   engineer_roadmap_skills  — per-user skill checklist progress
--
-- Re-runnable: every CREATE is preceded by DROP ... IF EXISTS CASCADE, and the
-- global seed rows (templates, roadmap months) are re-inserted each run. Per-user
-- roadmap skills are seeded lazily by the model (seedRoadmapSkillsForUser), mirroring
-- the finance ensureDefaults() pattern.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Drop in dependency order (children before parents) ───────────────────────
DROP TABLE IF EXISTS engineer_roadmap_skills CASCADE;
DROP TABLE IF EXISTS engineer_roadmap_months CASCADE;
DROP TABLE IF EXISTS engineer_issues         CASCADE;
DROP TABLE IF EXISTS engineer_checkins       CASCADE;
DROP TABLE IF EXISTS engineer_documents      CASCADE;
DROP TABLE IF EXISTS engineer_snippets       CASCADE;
DROP TABLE IF EXISTS engineer_templates      CASCADE;
DROP TABLE IF EXISTS engineer_projects       CASCADE;

-- ── engineer_projects ────────────────────────────────────────────────────────
-- A single engineering project. `platforms` and `stack` are comma-separated text
-- (free-form tag lists), kept as TEXT rather than arrays to match the project's
-- existing comma-separated tag convention (e.g. research_entries.tags).
CREATE TABLE engineer_projects (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  project_type VARCHAR(50) NOT NULL DEFAULT 'other'
                 CHECK (project_type IN ('iot','embedded','robotics','other')),
  platforms    TEXT,
  stack        TEXT,
  status       VARCHAR(50) NOT NULL DEFAULT 'idea'
                 CHECK (status IN ('idea','planning','development','testing','deployed','archived')),
  repo_url     VARCHAR(500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER engineer_projects_set_updated_at
  BEFORE UPDATE ON engineer_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_engineer_projects_user_id ON engineer_projects(user_id);
CREATE INDEX idx_engineer_projects_status  ON engineer_projects(status);
CREATE INDEX idx_engineer_projects_type    ON engineer_projects(project_type);

-- ── engineer_templates ───────────────────────────────────────────────────────
-- GLOBAL project scaffolding templates (shared across all users, no user_id).
-- folder_structure: JSONB array of { path, content }.
-- doc_templates:    JSONB array of { title, doc_type, content }.
CREATE TABLE engineer_templates (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  domain           VARCHAR(50) NOT NULL DEFAULT 'general'
                     CHECK (domain IN ('iot','embedded','robotics','general')),
  folder_structure JSONB,
  doc_templates    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engineer_templates_domain ON engineer_templates(domain);

-- ── engineer_snippets ────────────────────────────────────────────────────────
-- Per-user reusable code snippets. `category` is extensible free-text (the UI
-- offers a suggested list but does not constrain it). `tags` is comma-separated.
CREATE TABLE engineer_snippets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  category   VARCHAR(100) NOT NULL,
  language   VARCHAR(50)  NOT NULL DEFAULT 'cpp',
  tags       TEXT,
  code       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER engineer_snippets_set_updated_at
  BEFORE UPDATE ON engineer_snippets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_engineer_snippets_user_id  ON engineer_snippets(user_id);
CREATE INDEX idx_engineer_snippets_category ON engineer_snippets(category);
CREATE INDEX idx_engineer_snippets_language ON engineer_snippets(language);

-- ── engineer_documents ───────────────────────────────────────────────────────
-- Per-user markdown documents. `project_id` is nullable: a document may be global
-- (project_id IS NULL) or scoped to a project (FK, ON DELETE CASCADE).
CREATE TABLE engineer_documents (
  id         SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES engineer_projects(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  content    TEXT,
  doc_type   VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER engineer_documents_set_updated_at
  BEFORE UPDATE ON engineer_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_engineer_documents_user_id    ON engineer_documents(user_id);
CREATE INDEX idx_engineer_documents_project_id ON engineer_documents(project_id);

-- ── engineer_checkins ────────────────────────────────────────────────────────
-- Per-project weekly check-in log. One row per (project, week) by convention,
-- though not enforced — multiple amendments to the same week are allowed.
CREATE TABLE engineer_checkins (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES engineer_projects(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  achievements    TEXT,
  plans_next      TEXT,
  blockers        TEXT,
  bugs_discovered TEXT,
  concerns        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engineer_checkins_project_id ON engineer_checkins(project_id);
CREATE INDEX idx_engineer_checkins_user_id    ON engineer_checkins(user_id);
CREATE INDEX idx_engineer_checkins_week_start ON engineer_checkins(week_start DESC);

-- ── engineer_issues ──────────────────────────────────────────────────────────
-- Per-project issue tracker. Severity uses the P0–P3 vocabulary; status is the
-- standard open / in_progress / resolved lifecycle.
CREATE TABLE engineer_issues (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES engineer_projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  severity    VARCHAR(50) NOT NULL DEFAULT 'P2-Medium'
                CHECK (severity IN ('P0-Critical','P1-High','P2-Medium','P3-Low')),
  status      VARCHAR(50) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved')),
  component   VARCHAR(100),
  assignee    VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER engineer_issues_set_updated_at
  BEFORE UPDATE ON engineer_issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_engineer_issues_project_id ON engineer_issues(project_id);
CREATE INDEX idx_engineer_issues_user_id    ON engineer_issues(user_id);
CREATE INDEX idx_engineer_issues_status     ON engineer_issues(status);
CREATE INDEX idx_engineer_issues_severity   ON engineer_issues(severity);

-- ── engineer_roadmap_months ──────────────────────────────────────────────────
-- GLOBAL 12-month roadmap definition (shared across all users, no user_id).
-- The per-user checklist lives in engineer_roadmap_skills.
CREATE TABLE engineer_roadmap_months (
  id           SERIAL PRIMARY KEY,
  month_number INTEGER UNIQUE NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT
);

CREATE INDEX idx_engineer_roadmap_months_number ON engineer_roadmap_months(month_number);

-- ── engineer_roadmap_skills ──────────────────────────────────────────────────
-- Per-user progress against the global roadmap. Seeded lazily by the model from
-- a template list the first time a user opens the roadmap (seedRoadmapSkillsForUser).
CREATE TABLE engineer_roadmap_skills (
  id        SERIAL PRIMARY KEY,
  month_id  INTEGER NOT NULL REFERENCES engineer_roadmap_months(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category  VARCHAR(50) NOT NULL
              CHECK (category IN ('hardware','software','process')),
  title     VARCHAR(255) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_engineer_roadmap_skills_month_id ON engineer_roadmap_skills(month_id);
CREATE INDEX idx_engineer_roadmap_skills_user_id  ON engineer_roadmap_skills(user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA (global tables only — per-user rows are seeded lazily by the model)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Project scaffolding templates (4) ─────────────────────────────────────────
INSERT INTO engineer_templates (name, description, domain, folder_structure, doc_templates) VALUES
(
  'Heltec IoT (ESP32 + LoRa)',
  'Heltec WiFi LoRa 32 starter: sensor read loop, LoRa uplink, and OTA-ready PlatformIO layout.',
  'iot',
  '[
    {"path": "platformio.ini", "content": "[env:heltec_wifi_lora_32_V3]\nplatform = espressif32\nboard = heltec_wifi_lora_32_V3\nframework = arduino\nmonitor_speed = 115200\nlib_deps =\n  jgromes/RadioLib\n  bblanchon/ArduinoJson"},
    {"path": "src/main.cpp", "content": "#include <Arduino.h>\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  // read sensors, send LoRa uplink\n  delay(10000);\n}"},
    {"path": "include/config.h", "content": "#pragma once\n#define LORA_FREQUENCY 915.0\n#define UPLINK_INTERVAL_MS 10000"},
    {"path": "README.md", "content": "# Heltec IoT Node\n\nESP32 + LoRa sensor node.\n"}
  ]'::jsonb,
  '[
    {"title": "Architecture", "doc_type": "design", "content": "# Architecture\n\n## Hardware\n- Heltec WiFi LoRa 32 (V3)\n- Sensors: TBD\n\n## Data flow\nSensor -> ESP32 -> LoRa uplink -> Gateway -> Backend\n"},
    {"title": "Pinout", "doc_type": "reference", "content": "# Pinout\n\n| Function | GPIO |\n|----------|------|\n| SDA | 41 |\n| SCL | 42 |\n"}
  ]'::jsonb
),
(
  'STM32 FreeRTOS',
  'STM32 CubeMX + FreeRTOS task skeleton with a blink task and a sensor task.',
  'embedded',
  '[
    {"path": "Core/Src/main.c", "content": "/* USER CODE BEGIN Header */\n#include \"main.h\"\n#include \"cmsis_os.h\"\n/* USER CODE END Header */\n\nint main(void) {\n  HAL_Init();\n  osKernelInitialize();\n  // create tasks\n  osKernelStart();\n  while (1) { }\n}"},
    {"path": "Core/Src/tasks/blink_task.c", "content": "#include \"cmsis_os.h\"\n#include \"main.h\"\n\nvoid StartBlinkTask(void *argument) {\n  for (;;) {\n    HAL_GPIO_TogglePin(LED_GPIO_Port, LED_Pin);\n    osDelay(500);\n  }\n}"},
    {"path": "Core/Inc/main.h", "content": "#pragma once\n#include \"stm32f4xx_hal.h\"\n"},
    {"path": "README.md", "content": "# STM32 FreeRTOS Firmware\n\nGenerated from CubeMX with FreeRTOS (CMSIS-RTOS v2).\n"}
  ]'::jsonb,
  '[
    {"title": "Task Map", "doc_type": "design", "content": "# Task Map\n\n| Task | Priority | Period |\n|------|----------|--------|\n| Blink | Low | 500 ms |\n| Sensor | Normal | 100 ms |\n"},
    {"title": "Build & Flash", "doc_type": "runbook", "content": "# Build & Flash\n\n```\nmake -j\nst-flash write build/firmware.bin 0x8000000\n```\n"}
  ]'::jsonb
),
(
  'ROS2 Python Package',
  'ament_python ROS2 package with a publisher node and a subscriber node.',
  'robotics',
  '[
    {"path": "package.xml", "content": "<?xml version=\"1.0\"?>\n<package format=\"3\">\n  <name>my_pkg</name>\n  <version>0.0.0</version>\n  <description>TODO</description>\n  <maintainer email=\"you@example.com\">you</maintainer>\n  <license>Apache-2.0</license>\n  <depend>rclpy</depend>\n  <depend>std_msgs</depend>\n</package>"},
    {"path": "my_pkg/talker.py", "content": "import rclpy\nfrom rclpy.node import Node\nfrom std_msgs.msg import String\n\nclass Talker(Node):\n    def __init__(self):\n        super().__init__(''talker'')\n        self.pub = self.create_publisher(String, ''chatter'', 10)\n        self.create_timer(0.5, self.tick)\n\n    def tick(self):\n        msg = String()\n        msg.data = ''hello''\n        self.pub.publish(msg)\n\ndef main():\n    rclpy.init()\n    rclpy.spin(Talker())\n    rclpy.shutdown()"},
    {"path": "setup.py", "content": "from setuptools import setup\n\nsetup(\n    name=''my_pkg'',\n    version=''0.0.0'',\n    packages=[''my_pkg''],\n    entry_points={''console_scripts'': [''talker = my_pkg.talker:main'']},\n)"},
    {"path": "README.md", "content": "# my_pkg\n\nROS2 ament_python package.\n"}
  ]'::jsonb,
  '[
    {"title": "Node Graph", "doc_type": "design", "content": "# Node Graph\n\n```\n/talker --(/chatter std_msgs/String)--> /listener\n```\n"},
    {"title": "Run", "doc_type": "runbook", "content": "# Run\n\n```\ncolcon build\nsource install/setup.bash\nros2 run my_pkg talker\n```\n"}
  ]'::jsonb
),
(
  'Raspberry Pi Camera',
  'Raspberry Pi + picamera2 capture loop with OpenCV preprocessing scaffold.',
  'iot',
  '[
    {"path": "main.py", "content": "from picamera2 import Picamera2\nimport time\n\npicam2 = Picamera2()\npicam2.configure(picam2.create_still_configuration())\npicam2.start()\n\ntry:\n    while True:\n        picam2.capture_file(''frame.jpg'')\n        time.sleep(5)\nfinally:\n    picam2.stop()"},
    {"path": "requirements.txt", "content": "picamera2\nopencv-python\nnumpy"},
    {"path": "README.md", "content": "# Pi Camera Capture\n\nCaptures a frame every 5s using picamera2.\n"}
  ]'::jsonb,
  '[
    {"title": "Hardware Setup", "doc_type": "reference", "content": "# Hardware Setup\n\n- Raspberry Pi 4/5\n- Camera Module 3 via CSI ribbon\n- Enable camera: `sudo raspi-config`\n"},
    {"title": "Pipeline", "doc_type": "design", "content": "# Vision Pipeline\n\nCapture -> resize -> grayscale -> detect -> log\n"}
  ]'::jsonb
);

-- ── Roadmap months (12) ───────────────────────────────────────────────────────
INSERT INTO engineer_roadmap_months (month_number, title, description) VALUES
(1,  'Foundations & Toolchain',        'Set up your bench, editors, version control, and a reproducible build for one target board.'),
(2,  'Digital I/O & Timing',           'GPIO, interrupts, timers, and debouncing. Read buttons, drive LEDs, measure pulse widths.'),
(3,  'Serial & Buses',                 'UART, I2C, and SPI. Talk to sensors and displays; sniff buses with a logic analyzer.'),
(4,  'Sensors & Signal Conditioning',  'ADC, filtering, and calibration. Turn raw analog readings into trustworthy measurements.'),
(5,  'RTOS Fundamentals',              'Tasks, queues, semaphores, and timing guarantees with FreeRTOS.'),
(6,  'Connectivity (WiFi / LoRa / BLE)','Get data off the device: WiFi/MQTT, LoRa uplinks, and BLE GATT basics.'),
(7,  'Power & Low-Energy Design',      'Sleep modes, power budgeting, and battery life estimation for field deployment.'),
(8,  'PCB Design Basics',              'Schematic capture, footprints, and a 2-layer board from concept to fab files.'),
(9,  'Robotics Kinematics',            'Motors, encoders, PID control, and basic forward kinematics.'),
(10, 'ROS2 & Middleware',             'Nodes, topics, services, and launch files; integrate a sensor and an actuator.'),
(11, 'Computer Vision on the Edge',    'Capture, preprocess, and run lightweight inference on a Pi-class device.'),
(12, 'Systems Integration & Reliability','Bring it together: OTA updates, watchdogs, logging, and a field-ready enclosure.');
