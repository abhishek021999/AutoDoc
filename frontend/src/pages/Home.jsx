import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';

function Home() {
  const features = [
    {
      title: 'PDF Upload',
      description: 'Upload and manage your PDF documents securely in the cloud.',
      icon: '📄'
    },
    {
      title: 'Text Highlighting',
      description: 'Highlight important text and sections in your documents.',
      icon: '🖍️'
    },
    {
      title: 'Comments & Notes',
      description: 'Add comments and notes to your documents for better collaboration.',
      icon: '💭'
    },
    {
      title: 'Export Annotations',
      description: 'Export your annotated documents in various formats.',
      icon: '📤'
    },
    {
      title: 'Search & Filter',
      description: 'Easily search and filter through your documents and annotations.',
      icon: '🔍'
    },
    {
      title: 'Secure Storage',
      description: 'Your documents are stored securely with end-to-end encryption.',
      icon: '🔒'
    }
  ];

  return (
    <Container>
      {/* Hero Section */}
      <Row className="text-center py-5">
        <Col>
          <h1 className="display-4 mb-4">Welcome to AutoDoc</h1>
          <p className="lead mb-4">
            Your all-in-one solution for PDF annotation and document management.
          </p>
          <Button
            as={Link}
            to="/register"
            variant="primary"
            size="lg"
            className="me-3"
          >
            Get Started
          </Button>
          <Button
            as={Link}
            to="/login"
            variant="outline-primary"
            size="lg"
          >
            Sign In
          </Button>
        </Col>
      </Row>

      {/* Features Section */}
      <Row className="py-5">
        <Col>
          <h2 className="text-center mb-5">Features</h2>
          <Row>
            {features.map((feature, index) => (
              <Col key={index} md={4} className="mb-4">
                <Card className="h-100">
                  <Card.Body className="text-center">
                    <div className="display-4 mb-3">{feature.icon}</div>
                    <Card.Title>{feature.title}</Card.Title>
                    <Card.Text>{feature.description}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </Container>
  );
}

export default Home; 