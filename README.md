# AutoDoc - PDF Annotation Tool

AutoDoc is a web-based tool that allows users to upload PDF files, highlight text, add comments, and export annotated documents. Perfect for students, researchers, and professionals who need to collaborate on documents.

## Features

- PDF Upload & Management
  - Drag and drop interface
  - Multiple file upload support
  - Automatic file organization
- Text Highlighting
  - Multiple color options
  - Custom highlight styles
  - Batch highlight operations
- Comments & Notes
  - Rich text formatting
  - @mentions support
  - Threaded discussions
- Export Annotations
  - PDF export with annotations
  - Annotation summary reports
  - Custom export formats
- Search & Filter
  - Full-text search
  - Advanced filtering options
  - Saved searches
- Dark Mode Support
  - Automatic theme switching
  - Custom theme options
  - Reduced eye strain

## Tech Stack

### Backend
- Node.js (v18+)
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- AWS S3 for PDF storage
- Socket.IO for real-time features

### Frontend
- React 18
- Vite
- Chakra UI
- React PDF
- Axios
- React Query
- React Router
- Socket.IO Client

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- AWS Account with S3 access
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/autodoc.git
cd autodoc
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Create environment files:

Backend (.env):
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/autodoc
JWT_SECRET=your_jwt_secret_key_here
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_s3_bucket_name
```

Frontend (.env):
```
VITE_API_URL=http://localhost:5000
```

## Running the Application

1. Start the backend server:
```bash
cd backend
npm i
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm i
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/me - Get current user
- POST /api/auth/refresh - Refresh access token
- POST /api/auth/logout - Logout user

### PDFs
- GET /api/pdfs - Get all PDFs
- POST /api/pdfs - Upload a new PDF
- GET /api/pdfs/:id - Get a specific PDF
- DELETE /api/pdfs/:id - Delete a PDF
- GET /api/pdfs/:id/file - Get PDF file
- PATCH /api/pdfs/:id - Update PDF metadata

### Annotations
- GET /api/annotations/:pdfId - Get all annotations for a PDF
- POST /api/annotations - Create a new annotation
- PATCH /api/annotations/:id - Update an annotation
- DELETE /api/annotations/:id - Delete an annotation
- GET /api/annotations/search - Search annotations

### Users
- GET /api/users - Get all users (admin only)
- GET /api/users/:id - Get user profile
- PATCH /api/users/:id - Update user profile
- DELETE /api/users/:id - Delete user (admin only)

## Development



