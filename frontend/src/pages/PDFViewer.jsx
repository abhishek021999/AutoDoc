import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button, Form, Card, Alert, Spinner, Modal, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up the worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

const HIGHLIGHT_COLORS = {
  yellow: '#ffeb3b',
  blue: '#2196f3',
  green: '#4caf50',
  pink: '#e91e63',
  orange: '#ff9800'
};

function PDFViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [annotation, setAnnotation] = useState('');
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfData, setPdfData] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [highlightComment, setHighlightComment] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [highlightedText, setHighlightedText] = useState(null);
  const pageRefs = useRef({});

  // Memoize the PDF options to prevent unnecessary re-renders
  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@2.16.105/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@2.16.105/standard_fonts/',
    withCredentials: true
  }), []);

  useEffect(() => {
    fetchPdf();
    return () => {
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
    };
  }, [id]);

  const fetchPdf = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/pdfs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPdf(response.data);
      setHighlights(response.data.highlights || []);

      const pdfResponse = await fetch(response.data.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
        credentials: 'include'
      });

      if (!pdfResponse.ok) {
        throw new Error('Failed to fetch PDF content');
      }

      const pdfBlob = await pdfResponse.blob();
      
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
      
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfData(blobUrl);
    } catch (err) {
      console.error('Error fetching PDF:', err);
      setError('Failed to fetch PDF. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelection = (e) => {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      setSelectedText(selection.toString());
      setShowHighlightModal(true);
      setIsSelecting(true);
      setSelectionStart(selection.anchorOffset);
      setSelectionEnd(selection.focusOffset);
    }
  };

  const handleAddHighlight = async () => {
    if (!selectedText.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const newHighlight = {
        text: selectedText,
        color: highlightColor,
        comment: highlightComment,
        page: pageNumber,
        start: selectionStart,
        end: selectionEnd
      };

      console.log('Adding highlight:', newHighlight);

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/highlights`,
        newHighlight,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Add highlight response:', response.data);

      // Add the new highlight to the state
      setHighlights([...highlights, response.data]);
      setShowHighlightModal(false);
      setSelectedText('');
      setHighlightComment('');
      setHighlightColor('yellow');
      setIsSelecting(false);
    } catch (err) {
      console.error('Error adding highlight:', err);
      setError('Failed to add highlight');
    }
  };

  const handleDeleteHighlight = async (highlightId) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Deleting highlight:', highlightId);

      // Store the current highlights for potential rollback
      const previousHighlights = [...highlights];

      // First remove from state to give immediate feedback
      setHighlights(highlights.filter(h => h._id !== highlightId));

      const response = await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/highlights/${highlightId}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Delete response:', response.data);

      // Verify the response
      if (!response.data || response.data.message !== 'Highlight deleted successfully') {
        throw new Error('Failed to delete highlight');
      }

      // Verify the highlight was actually removed
      if (response.data.removedHighlight) {
        console.log('Highlight successfully removed:', response.data.removedHighlight);
        // No need to update state again since we already removed it
        setError('');
      } else {
        throw new Error('Highlight removal not confirmed by server');
      }
    } catch (err) {
      console.error('Error deleting highlight:', err);
      // Revert the state change on error
      setHighlights(previousHighlights);
      // Show error message without redirecting
      setError(err.response?.data?.message || 'Failed to delete highlight');
      
      // Show error for 3 seconds then clear it
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  const handleAddAnnotation = async () => {
    if (!annotation.trim()) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/annotations`,
        {
          text: annotation,
          page: pageNumber
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAnnotation('');
      fetchPdf();
    } catch (err) {
      console.error('Error adding annotation:', err);
      setError('Failed to add annotation');
    }
  };

  const handleDeleteAnnotation = async (annotationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/annotations/${annotationId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchPdf();
    } catch (err) {
      console.error('Error deleting annotation:', err);
      setError('Failed to delete annotation');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPdfLoading(false);
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF. Please try refreshing the page.');
    setPdfLoading(false);
  };

  const handleEditHighlight = (highlight) => {
    console.log('Editing highlight:', highlight);
    setEditingHighlight(highlight);
    setHighlightColor(highlight.color || 'yellow');
    setHighlightComment(highlight.comment || '');
    setShowEditModal(true);
    // Prevent the highlight navigation
    setHighlightedText(null);
  };

  const handleUpdateHighlight = async () => {
    if (!editingHighlight) return;

    try {
      const token = localStorage.getItem('token');
      const updatedHighlight = {
        color: highlightColor,
        comment: highlightComment
      };

      console.log('Updating highlight:', {
        id: editingHighlight._id,
        data: updatedHighlight
      });

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/highlights/${editingHighlight._id}`,
        updatedHighlight,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Update response:', response.data);

      // Update the highlights array with the new data
      setHighlights(highlights.map(h => 
        h._id === editingHighlight._id ? { ...h, ...response.data } : h
      ));

      setShowEditModal(false);
      setEditingHighlight(null);
      setHighlightComment('');
      setHighlightColor('yellow');
    } catch (err) {
      console.error('Error updating highlight:', err);
      setError('Failed to update highlight');
    }
  };

  const navigateToHighlight = (highlight) => {
    console.log('Navigating to highlight:', highlight);
    setPageNumber(highlight.page);
    setHighlightedText(highlight);
    
    // Wait for the page to render before scrolling
    setTimeout(() => {
      const pageElement = pageRefs.current[highlight.page];
      if (pageElement) {
        console.log('Found page element');
        // Find the text layer
        const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
        if (textLayer) {
          console.log('Found text layer');
          // Find all text spans
          const textSpans = textLayer.querySelectorAll('span');
          console.log('Found spans:', textSpans.length);
          let foundSpan = null;
          
          // Look for the text match
          textSpans.forEach(span => {
            const spanText = span.textContent.trim();
            const highlightText = highlight.text.trim();
            console.log('Comparing:', { spanText, highlightText });
            
            // More lenient matching - check if the span contains the highlight text
            if (spanText.includes(highlightText)) {
              foundSpan = span;
              console.log('Found matching span:', spanText);
            }
          });

          if (foundSpan) {
            console.log('Scrolling to span');
            // Scroll the highlight into view
            foundSpan.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });

            // Add a temporary highlight effect
            foundSpan.style.backgroundColor = `${HIGHLIGHT_COLORS[highlight.color]}80`;
            setTimeout(() => {
              foundSpan.style.backgroundColor = '';
            }, 4000);
          } else {
            console.log('No matching span found');
          }
        } else {
          console.log('Text layer not found');
        }
      } else {
        console.log('Page element not found');
      }
    }, 500); // Wait for page render
  };

  const renderSidebar = () => {
    return (
      <div 
        className="sidebar bg-white" 
        style={{ 
          height: '100%',
          overflowY: 'auto',
          borderRight: '1px solid #dee2e6',
          boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
          transition: 'all 0.3s ease',
          width: isSidebarCollapsed ? '50px' : '300px',
          position: 'relative'
        }}
      >
        <Button
          variant="light"
          className="position-absolute"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{ 
            zIndex: 1000,
            right: '8px',
            top: '20px',
            width: '20px',
            height: '20px',
            padding: 0,
            borderRadius: '50%',
            border: '1px solid #dee2e6',
            backgroundColor: 'white',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          <i className={`bi bi-chevron-${isSidebarCollapsed ? 'right' : 'left'}`} style={{ fontSize: '0.7rem' }}></i>
        </Button>

        <div className="p-3" style={{ display: isSidebarCollapsed ? 'none' : 'block' }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="mb-0">Highlights & Notes</h4>
          </div>

          {highlights.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-highlighter display-4"></i>
              <p className="mt-3">No highlights yet</p>
              <small>Select text in the PDF to add highlights</small>
            </div>
          ) : (
            <ListGroup>
              {highlights.map((highlight, index) => (
                <ListGroup.Item 
                  key={highlight._id || index}
                  className="mb-3 p-3"
                  style={{ 
                    borderLeft: `4px solid ${HIGHLIGHT_COLORS[highlight.color]}`,
                    cursor: 'pointer',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    backgroundColor: pageNumber === highlight.page ? '#f8f9fa' : 'white'
                  }}
                  onClick={() => navigateToHighlight(highlight)}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center mb-2">
                        <span 
                          className="badge rounded-pill me-2"
                          style={{ 
                            backgroundColor: HIGHLIGHT_COLORS[highlight.color],
                            color: '#000'
                          }}
                        >
                          Page {highlight.page}
                        </span>
                        <small className="text-muted">
                          {new Date(highlight.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      
                      <div className="highlight-text mb-2 p-2 rounded" 
                        style={{ 
                          backgroundColor: `${HIGHLIGHT_COLORS[highlight.color]}40`,
                          border: `1px solid ${HIGHLIGHT_COLORS[highlight.color]}80`
                        }}
                      >
                        {highlight.text}
                      </div>

                      {highlight.comment && (
                        <div className="highlight-comment mt-2 p-2 bg-light rounded">
                          <small className="text-muted d-block mb-1">
                            <i className="bi bi-chat-left-text me-1"></i>
                            Comment
                          </small>
                          <p className="mb-0">{highlight.comment}</p>
                        </div>
                      )}
                    </div>

                    <div className="ms-2 d-flex flex-column">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary p-0 mb-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditHighlight(highlight);
                        }}
                        title="Edit highlight"
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHighlight(highlight._id);
                        }}
                        title="Delete highlight"
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </div>

        {isSidebarCollapsed && (
          <div className="d-flex justify-content-center align-items-center h-100">
            <i className="bi bi-highlighter display-6 text-primary"></i>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Container>
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert variant="danger" className="mt-4">
          {error}
          <div className="mt-3">
            <Button variant="outline-primary" onClick={() => navigate('/library')}>
              Back to Library
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }

  if (!pdf) {
    return (
      <Container>
        <Alert variant="warning" className="mt-4">
          PDF not found
          <div className="mt-3">
            <Button variant="outline-primary" onClick={() => navigate('/library')}>
              Back to Library
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }

  return (
    <div style={{ 
      position: 'fixed',
      top: '56px',
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      zIndex: 1
    }}>
      <Container fluid className="p-0 h-100">
        <Row className="g-0 h-100" style={{ 
          overflow: 'hidden'
        }}>
          <Col style={{ 
            width: isSidebarCollapsed ? '50px' : '300px',
            transition: 'all 0.3s ease',
            flex: '0 0 auto',
            height: '100%',
            position: 'fixed',
            left: 0,
            top: '56px',
            zIndex: 2,
            backgroundColor: 'white',
            borderRight: '1px solid #dee2e6',
            overflowY: 'auto'
          }}>
            {renderSidebar()}
          </Col>
          <Col style={{ 
            transition: 'all 0.3s ease',
            flex: '1 1 auto',
            width: isSidebarCollapsed ? 'calc(100% - 50px)' : 'calc(100% - 300px)',
            marginLeft: isSidebarCollapsed ? '50px' : '300px',
            height: '100%',
            overflow: 'auto',
            backgroundColor: '#f8f9fa',
            position: 'fixed',
            top: '56px',
            right: 0,
            zIndex: 2
          }}>
            <div className="pdf-container p-3">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </div>
              ) : error ? (
                <Alert variant="danger">{error}</Alert>
              ) : (
                <div className="pdf-viewer">
                  <div className="pdf-controls bg-white py-2" style={{ 
                    zIndex: 1030,
                    borderBottom: '1px solid #dee2e6',
                    position: 'fixed',
                    top: '56px',
                    left: isSidebarCollapsed ? '50px' : '300px',
                    right: 0,
                    padding: '0.5rem 1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setPageNumber(page => Math.max(1, page - 1))}
                          disabled={pageNumber <= 1}
                        >
                          <i className="bi bi-chevron-left"></i>
                        </Button>
                        <span className="mx-3">
                          Page {pageNumber} of {numPages}
                        </span>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setPageNumber(page => Math.min(numPages, page + 1))}
                          disabled={pageNumber >= numPages}
                        >
                          <i className="bi bi-chevron-right"></i>
                        </Button>
                      </div>
                      <div className="d-flex align-items-center">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                        >
                          <i className="bi bi-zoom-out"></i>
                        </Button>
                        <span className="mx-2">{Math.round(scale * 100)}%</span>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => setScale(s => Math.min(2, s + 0.1))}
                        >
                          <i className="bi bi-zoom-in"></i>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div 
                    className="pdf-document mt-4"
                    onMouseUp={handleTextSelection}
                  >
                    <Document
                      file={pdfData}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      options={pdfOptions}
                      loading={
                        <div className="text-center py-5">
                          <Spinner animation="border" role="status">
                            <span className="visually-hidden">Loading PDF...</span>
                          </Spinner>
                        </div>
                      }
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        inputRef={el => {
                          if (el) {
                            pageRefs.current[pageNumber] = el;
                          }
                        }}
                      />
                    </Document>
                  </div>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Container>

      {/* Highlight Modal */}
      <Modal show={showHighlightModal} onHide={() => setShowHighlightModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Highlight</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Selected Text</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={selectedText}
                readOnly
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Color</Form.Label>
              <div className="d-flex gap-2">
                {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
                  <Button
                    key={name}
                    variant="outline-secondary"
                    style={{
                      backgroundColor: highlightColor === name ? color : 'transparent',
                      borderColor: color,
                      width: '40px',
                      height: '40px'
                    }}
                    onClick={() => setHighlightColor(name)}
                  />
                ))}
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Comment (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={highlightComment}
                onChange={(e) => setHighlightComment(e.target.value)}
                placeholder="Add a comment to your highlight..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHighlightModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddHighlight}>
            Add Highlight
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Highlight Modal */}
      <Modal show={showEditModal} onHide={() => {
        setShowEditModal(false);
        setEditingHighlight(null);
        setHighlightComment('');
        setHighlightColor('yellow');
      }}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Highlight</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Selected Text</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={editingHighlight?.text || ''}
                readOnly
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Color</Form.Label>
              <div className="d-flex gap-2">
                {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
                  <Button
                    key={name}
                    variant="outline-secondary"
                    style={{
                      backgroundColor: highlightColor === name ? color : 'transparent',
                      borderColor: color,
                      width: '40px',
                      height: '40px'
                    }}
                    onClick={() => setHighlightColor(name)}
                  />
                ))}
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Comment</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={highlightComment}
                onChange={(e) => setHighlightComment(e.target.value)}
                placeholder="Add a comment to your highlight..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowEditModal(false);
            setEditingHighlight(null);
            setHighlightComment('');
            setHighlightColor('yellow');
          }}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateHighlight}>
            Update Highlight
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default PDFViewer; 