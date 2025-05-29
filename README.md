# AutoDoc - PDF Annotation Tool

AutoDoc is a web-based tool that allows users to upload PDF files, highlight text, add comments, and export annotated documents. Perfect for students, researchers, and professionals who need to collaborate on documents.

## Features

- PDF Upload & Management
- Text Highlighting
- Comments & Notes
- Export Annotations
- Search & Filter
- Dark Mode Support

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB
- JWT Authentication
- Cloudinary for PDF storage

### Frontend
- React
- Vite
- Chakra UI
- React PDF
- Axios

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Cloudinary account

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
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Frontend (.env):
```
VITE_API_URL=http://localhost:5000
```

## Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/me - Get current user

### PDFs
- GET /api/pdfs - Get all PDFs
- POST /api/pdfs - Upload a new PDF
- GET /api/pdfs/:id - Get a specific PDF
- DELETE /api/pdfs/:id - Delete a PDF
- GET /api/pdfs/:id/file - Get PDF file

### Annotations
- GET /api/annotations/:pdfId - Get all annotations for a PDF
- POST /api/annotations - Create a new annotation
- PATCH /api/annotations/:id - Update an annotation
- DELETE /api/annotations/:id - Delete an annotation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 