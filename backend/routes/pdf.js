const express = require('express');
const multer = require('multer');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, bucketName, getS3Url, getCorsHeaders } = require('../config/s3');
const PDF = require('../models/PDF');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// Add CORS middleware
router.use((req, res, next) => {
  Object.entries(getCorsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
});

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Helper function to generate signed URL
const generateSignedUrl = async (key) => {
  if (!key) {
    console.error('Storage path is missing');
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: 'inline; filename="document.pdf"',
    });

    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600,
      signableHeaders: new Set(['host', 'range', 'origin'])
    });
    
    console.log('Generated signed URL for key:', key);
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL for key:', key, error);
    return null;
  }
};

// Upload PDF
router.post('/upload', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file;
    const key = `pdfs/${req.user.id}/${Date.now()}-${file.originalname}`;

    console.log('Uploading file with key:', key);

    // Upload to S3
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline'
    };

    try {
      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log('File uploaded to S3 successfully');

      // Generate a signed URL for the uploaded file
      const signedUrl = await generateSignedUrl(key);
      if (!signedUrl) {
        throw new Error('Failed to generate signed URL');
      }

      // Save PDF document to database
      const pdfDoc = new PDF({
        title: file.originalname,
        url: signedUrl,
        storagePath: key,
        user: req.user.id,
        size: file.size,
        uploadDate: new Date()
      });

      await pdfDoc.save();
      console.log('PDF document saved to database');

      res.status(201).json({
        message: 'PDF uploaded successfully',
        pdf: pdfDoc,
      });
    } catch (s3Error) {
      console.error('S3 upload error:', s3Error);
      throw new Error(`S3 upload failed: ${s3Error.message}`);
    }
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({
      message: 'Error uploading PDF',
      error: error.message
    });
  }
});

// Get all PDFs for a user
router.get('/', auth, async (req, res) => {
  try {
    const pdfs = await PDF.find({ user: req.user.id }).select('+uploadDate');
    console.log(`Found ${pdfs.length} PDFs for user ${req.user.id}`);
    
    // Generate new signed URLs for each PDF
    const pdfsWithUrls = await Promise.all(
      pdfs.map(async (pdf) => {
        try {
          if (!pdf.storagePath) {
            console.warn(`PDF ${pdf._id} has no storage path`);
            return {
              ...pdf.toObject(),
              url: null,
              error: 'Storage path missing'
            };
          }

          console.log('Generating URL for PDF:', pdf._id, 'with storage path:', pdf.storagePath);
          const signedUrl = await generateSignedUrl(pdf.storagePath);
          
          if (!signedUrl) {
            return {
              ...pdf.toObject(),
              url: null,
              error: 'Failed to generate signed URL'
            };
          }

          return {
            ...pdf.toObject(),
            url: signedUrl,
          };
        } catch (error) {
          console.error(`Error processing PDF ${pdf._id}:`, error);
          return {
            ...pdf.toObject(),
            url: null,
            error: error.message
          };
        }
      })
    );

    res.json(pdfsWithUrls);
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({
      message: 'Error fetching PDFs',
      error: error.message
    });
  }
});

// Get a single PDF
router.get('/:id', auth, async (req, res) => {
  try {
    const pdf = await PDF.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).select('+uploadDate');

    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (!pdf.storagePath) {
      return res.status(400).json({ 
        message: 'PDF has no storage path',
        pdf: pdf.toObject()
      });
    }

    console.log('Generating URL for PDF:', pdf._id, 'with storage path:', pdf.storagePath);
    const signedUrl = await generateSignedUrl(pdf.storagePath);

    if (!signedUrl) {
      return res.status(500).json({
        message: 'Failed to generate signed URL',
        pdf: pdf.toObject()
      });
    }

    res.json({
      ...pdf.toObject(),
      url: signedUrl,
    });
  } catch (error) {
    console.error('Error fetching PDF:', error);
    res.status(500).json({
      message: 'Error fetching PDF',
      error: error.message
    });
  }
});

// Delete PDF
router.delete('/:id', auth, async (req, res) => {
  try {
    const pdf = await PDF.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (pdf.storagePath) {
      console.log('Deleting file from S3:', pdf.storagePath);
      // Delete from S3
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: pdf.storagePath,
        })
      );
    }

    // Delete from database
    await PDF.deleteOne({ _id: req.params.id });
    console.log('PDF deleted successfully');

    res.json({ message: 'PDF deleted successfully' });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({
      message: 'Error deleting PDF',
      error: error.message
    });
  }
});

// Test S3 connection
router.get('/test-s3', auth, async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: 'test.txt'
    });
    await s3Client.send(command);
    res.json({ 
      message: 'S3 connection successful',
      bucket: bucketName,
      region: process.env.AWS_REGION
    });
  } catch (error) {
    console.error('S3 test error:', error);
    res.status(500).json({ message: 'S3 connection failed', error: error.message });
  }
});

// Highlight routes - moved to top to avoid conflicts
// Add highlight to PDF
router.post('/:id/highlights', auth, async (req, res) => {
  try {
    console.log('Adding highlight to PDF:', req.params.id);
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    const { text, color, comment, page, start, end } = req.body;
    if (!text || !page || start === undefined || end === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const highlight = {
      text,
      color: color || 'yellow',
      comment,
      page,
      start,
      end,
      createdAt: new Date()
    };

    pdf.highlights.push(highlight);
    await pdf.save();

    res.status(201).json(highlight);
  } catch (error) {
    console.error('Error adding highlight:', error);
    res.status(500).json({ message: 'Error adding highlight' });
  }
});

// Update highlight
router.put('/:id/highlights/:highlightId', auth, async (req, res) => {
  try {
    console.log('Update highlight request:', {
      pdfId: req.params.id,
      highlightId: req.params.highlightId,
      body: req.body
    });

    const pdf = await PDF.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!pdf) {
      console.log('PDF not found:', req.params.id);
      return res.status(404).json({ message: 'PDF not found' });
    }

    const highlightIndex = pdf.highlights.findIndex(
      h => h._id.toString() === req.params.highlightId
    );

    if (highlightIndex === -1) {
      console.log('Highlight not found:', req.params.highlightId);
      return res.status(404).json({ message: 'Highlight not found' });
    }

    const { color, comment } = req.body;
    console.log('Updating highlight with:', { color, comment });

    // Update the highlight
    if (color) pdf.highlights[highlightIndex].color = color;
    if (comment !== undefined) pdf.highlights[highlightIndex].comment = comment;

    await pdf.save();
    console.log('Highlight updated successfully');

    // Return the updated highlight
    res.json(pdf.highlights[highlightIndex]);
  } catch (error) {
    console.error('Error updating highlight:', error);
    res.status(500).json({ message: 'Error updating highlight' });
  }
});

// Delete highlight
router.delete('/:id/highlights/:highlightId', auth, async (req, res) => {
  try {
    const pdfId = req.params.id;
    const highlightId = req.params.highlightId;
    const userId = req.user.id;

    console.log('Delete highlight request:', {
      pdfId,
      highlightId,
      userId
    });

    // Use MongoDB's native update operation to remove the highlight
    const result = await PDF.updateOne(
      {
        _id: pdfId,
        user: userId
      },
      {
        $pull: {
          highlights: {
            _id: new mongoose.Types.ObjectId(highlightId)
          }
        }
      }
    );

    console.log('Update result:', result);

    if (result.matchedCount === 0) {
      console.log('PDF not found or unauthorized:', {
        pdfId,
        userId
      });
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (result.modifiedCount === 0) {
      console.log('No highlight was removed:', highlightId);
      return res.status(404).json({ message: 'Highlight not found' });
    }

    // Verify the highlight was actually removed
    const pdf = await PDF.findOne({
      _id: pdfId,
      'highlights._id': { $ne: new mongoose.Types.ObjectId(highlightId) }
    });

    if (!pdf) {
      throw new Error('Failed to verify highlight deletion');
    }

    console.log('Highlight deleted successfully:', {
      highlightId,
      remainingHighlights: pdf.highlights.length
    });

    res.json({ 
      message: 'Highlight deleted successfully',
      highlightId
    });
  } catch (error) {
    console.error('Error deleting highlight:', {
      error: error.message,
      stack: error.stack,
      pdfId: req.params.id,
      highlightId: req.params.highlightId
    });
    res.status(500).json({ 
      message: 'Error deleting highlight',
      error: error.message 
    });
  }
});

module.exports = router; 