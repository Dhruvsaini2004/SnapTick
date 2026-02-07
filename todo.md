# Attendance Lab - Development Progress

## Changes Done

### Phase 1: Core Face Recognition
- Added multi-descriptor storage for students and a new `/enroll/descriptors` API.
- Switched frontend face matching to use stored descriptors instead of image reprocessing.
- Aligned face detection to SSD Mobilenet in frontend and backend with `minConfidence: 0.6`.
- Added image-only uploads + size limits and duplicate roll number checks.
- Reduced duplicate attendance marking by checking existing records for the day.
- Updated UI to a warm skin-tone theme with new fonts and refined layout/animations.

### Phase 2: DeepFace Integration
- Integrated DeepFace Python service with ArcFace model for better accuracy.
- Added tunable thresholds (`FACE_MATCH_THRESHOLD = 0.60`, `FACE_MATCH_GAP = 0.05`).
- Added Re-embed feature to regenerate all embeddings when model changes.
- Added Diagnose feature to debug face matching issues.

### Phase 3: Review & Correction Workflow
- Changed attendance from immediate marking to review-first workflow.
- Added CorrectionModal for reassigning faces to different students.
- Every confirmed face now automatically adds to training data.
- Added training sample limit (max 10 embeddings per student).

### Phase 4: Multi-Tenant Classroom System
- Added Teacher model with JWT authentication (register, login, verify).
- Added Classroom model with CRUD operations.
- Students and Attendance now scoped to Teacher + Classroom.
- Added beautiful Landing page with marketing content.
- Added Login/Register page with responsive design.
- Added Dashboard layout with sidebar navigation.
- Added ClassroomView with nested routes (Enrollment, Smart Scan, Records).
- Protected routes require authentication.

### Phase 5: Utilities & Cleanup
- Created migration script: `Backend/scripts/migrate-descriptors.js`
- Added training sample limit (MAX_TRAINING_SAMPLES = 10) to prevent DB bloat.
- Added unique compound indexes for attendance per classroom per day.

## Remaining Tasks

- [ ] Add fallback UI for camera/model load errors.
- [ ] Consider adding a user-visible label map in realtime face detection (rollNumber -> name).
- [ ] Add password reset functionality.
- [ ] Add export attendance to CSV/Excel.
- [ ] Add attendance analytics/reports dashboard.
- [ ] Add student bulk import feature.

## API Endpoints

### Auth
| Endpoint | Method | Description |
|----------|--------|-------------|
| /auth/register | POST | Register new teacher |
| /auth/login | POST | Login teacher |
| /auth/verify | GET | Verify token |
| /auth/teachers | GET | List all teachers (admin) |
| /auth/change-password | PUT | Change password |

### Classrooms
| Endpoint | Method | Description |
|----------|--------|-------------|
| /classroom | GET | List teacher's classrooms |
| /classroom | POST | Create classroom |
| /classroom/:id | GET | Get single classroom |
| /classroom/:id | PUT | Update classroom |
| /classroom/:id | DELETE | Delete classroom (cascade) |

### Students
| Endpoint | Method | Description |
|----------|--------|-------------|
| /enroll | GET | List students (?classroomId=) |
| /enroll | POST | Enroll student (multipart) |
| /enroll/:id | PUT | Update student |
| /enroll/:id | DELETE | Delete student |
| /enroll/:id/add-photo | POST | Add training photo |
| /enroll/:id/reset-photos | DELETE | Reset to single photo |
| /enroll/descriptors | GET | Get face descriptors |
| /enroll/re-embed | POST | Re-embed all students |

### Attendance
| Endpoint | Method | Description |
|----------|--------|-------------|
| /attendance/upload | POST | Upload photo, get detections for review |
| /attendance/confirm | POST | Confirm detections, mark attendance |
| /attendance | GET | Get records (?classroomId=&date=) |
| /attendance/mark | POST | Manual mark |
| /attendance/unmark | DELETE | Unmark attendance |
| /attendance/diagnose | POST | Diagnose matching issues |
