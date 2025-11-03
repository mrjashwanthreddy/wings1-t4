# Spring Boot Wings 1 — Timed Quiz (500 MCQs)

This repository hosts a time-based quiz web app and a question bank for Spring Boot Wings 1 (Java + Spring Boot + microservices).

Live site (after enabling GitHub Pages for `main` → `/docs`):
https://mrjashwanthreddy.github.io/wings1-t4/

Features
- Target: 500 questions (450 single-correct + 50 multiple-correct), difficulty mix 40% easy / 45% medium / 15% hard
- Each test: 50 randomized questions, 2 minutes per question, option shuffling
- End-of-quiz report (topic + difficulty breakdown), CSV export, printable review
- Printable pages to save as PDFs: all questions (no answers) and answer key

Quick start
1) Enable GitHub Pages (Settings → Pages → Build and deployment):
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/docs`
   - Save
2) Open the site URL GitHub shows (should be: https://mrjashwanthreddy.github.io/wings1-t4/)
3) Use the “All Questions” and “Answer Key” links to Print → Save as PDF

Local run (optional)
```bash
python3 -m http.server -d docs 8080
# or
npx serve docs
```

Project structure
- /docs/index.html — Quiz UI (time-based)
- /docs/app.js — Quiz logic (timer/randomizer/report)
- /docs/styles.css — Styles + print styles
- /docs/questions.html — All questions (print to PDF; no answers)
- /docs/answer-key.html — Answer key (print to PDF; with explanations)
- /docs/questions.json — Question bank (seeded now; will be replaced with full 500)