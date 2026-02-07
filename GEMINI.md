# Project Overview

This is a full-stack web application for managing attendance using face recognition. The project is divided into a Node.js backend and a React frontend.

**Backend:**

*   **Framework:** Express.js
*   **Database:** MongoDB (using Mongoose)
*   **Key Libraries:**
    *   `face-api.js`: For face recognition.
    *   `multer`: For handling file uploads (likely for student images).
    *   `cors`: For enabling Cross-Origin Resource Sharing.
*   **Functionality:** The backend seems to handle student enrollment, attendance marking, and the underlying face recognition logic.

**Frontend:**

*   **Framework:** React (using Vite)
*   **Key Libraries:**
    *   `react-router-dom`: For routing within the application.
*   **Functionality:** The frontend provides a user interface for:
    *   Enrolling new students.
    *   Uploading images for attendance.
    *   Manually marking attendance.
    *   Detecting faces from a webcam stream.

# Building and Running

## Backend

To run the backend server:

```bash
cd Backend
npm install
npm run dev
```

The server will start on the port specified in the `.env` file or the default port (likely 3000 or 5000).

## Frontend

To run the frontend application:

```bash
cd Frontend
npm install
npm run dev
```

The development server will start on the port specified by Vite (likely 5173).

# Development Conventions

*   **Code Style:** The project uses ESLint for code linting in the frontend. It is recommended to run `npm run lint` in the `Frontend` directory to check for code style issues.
*   **Testing:** There are no explicit test scripts defined in the `package.json` files, other than the default "echo" command. It is recommended to add a testing framework like Jest or Vitest to the project.
*   **Dependencies:** The root `package.json` file contains a mix of backend and frontend dependencies. For better separation of concerns, it is recommended to manage backend and frontend dependencies in their respective `package.json` files.
