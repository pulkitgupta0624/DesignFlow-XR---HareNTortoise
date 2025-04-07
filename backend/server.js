// This would be in your backend application (e.g., Node.js with Express)
import express from 'express';
import cors from 'cors';
import { createShapeFromText } from './ai-shape-generator.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to get available shapes
app.get('/api/shapes/available', (req, res) => {
  // In a real implementation, this might be dynamic based on your AI model's capabilities
  const availableShapes = [
    'rectangle', 'circle', 'triangle', 'star', 
    'hexagon', 'octagon', 'heart', 'arrow',
    'cloud', 'diamond', 'oval', 'crescent',
    'cross', 'polygon', 'trapezoid', 'parallelogram'
    
  ];
  
  res.json({ status: 'success', shapes: availableShapes });
});

// Endpoint to generate shape from text
app.post('/api/shapes/generate', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Text command is required' 
      });
    }
    
    // Process the text using AI to extract shape information
    const shapeData = await createShapeFromText(text);
    
    res.json({
      status: 'success',
      shape: shapeData
    });
  } catch (error) {
    console.error('Error generating shape:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to generate shape' 
    });
  }
});

// Simple demo endpoint if you don't want to set up Gemini API yet
app.post('/api/shapes/generate-demo', (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Text command is required' 
    });
  }
  
  // Extract basic shape information from text
  const lowerText = text.toLowerCase();
  
  // Try to find shape name in the text
  const shapeKeywords = {
    'triangle': { type: 'triangle', sides: 3 },
    'square': { type: 'square', sides: 4 },
    'rectangle': { type: 'rectangle', sides: 4 },
    'pentagon': { type: 'pentagon', sides: 5 },
    'hexagon': { type: 'hexagon', sides: 6 },
    'octagon': { type: 'octagon', sides: 8 },
    'circle': { type: 'circle', sides: 32 },
    'star': { type: 'star', special: true },
    'heart': { type: 'heart', special: true },
    'arrow': { type: 'arrow', special: true },
    'cloud': { type: 'cloud', special: true }
  };
  
  // Default shape data
  let shapeType = 'polygon';
  let sides = Math.floor(Math.random() * 6) + 3; // 3-8 sides
  let special = false;
  
  // Try to find a shape keyword in the text
  for (const [keyword, data] of Object.entries(shapeKeywords)) {
    if (lowerText.includes(keyword)) {
      shapeType = data.type;
      sides = data.sides || sides;
      special = data.special || false;
      break;
    }
  }
  
  // Extract color if present
  const colorKeywords = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'white', 'orange'];
  let color = null;
  
  for (const colorName of colorKeywords) {
    if (lowerText.includes(colorName)) {
      color = colorName;
      break;
    }
  }
  
  // Generate points based on shape type
  const center = { x: 150, y: 150 };
  const size = 80;
  let points = [];
  
  if (shapeType === 'star') {
    const outerRadius = size;
    const innerRadius = size * 0.4;
    const numPoints = 5;
    
    for (let i = 0; i < numPoints * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / numPoints) * i;
      points.push({
        x: center.x + radius * Math.sin(angle),
        y: center.y + radius * Math.cos(angle)
      });
    }
  } else if (shapeType === 'heart') {
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * 2 * Math.PI;
      const heartX = 16 * Math.pow(Math.sin(angle), 3);
      const heartY = 13 * Math.cos(angle) - 5 * Math.cos(2*angle) - 2 * Math.cos(3*angle) - Math.cos(4*angle);
      points.push({
        x: center.x + heartX * 5,
        y: center.y - heartY * 5
      });
    }
  } else if (shapeType === 'arrow') {
    points = [
      { x: center.x - size, y: center.y - size/4 },
      { x: center.x - size/4, y: center.y - size/4 },
      { x: center.x - size/4, y: center.y - size/2 },
      { x: center.x + size, y: center.y },
      { x: center.x - size/4, y: center.y + size/2 },
      { x: center.x - size/4, y: center.y + size/4 },
      { x: center.x - size, y: center.y + size/4 }
    ];
  } else if (shapeType === 'cloud') {
    // Simplified cloud shape
    const baseRadius = size / 3;
    const centerPoints = [
      { x: center.x - baseRadius, y: center.y - baseRadius/2 },
      { x: center.x + baseRadius, y: center.y - baseRadius/2 },
      { x: center.x - baseRadius*1.5, y: center.y + baseRadius/2 },
      { x: center.x, y: center.y + baseRadius/2 },
      { x: center.x + baseRadius*1.5, y: center.y + baseRadius/2 }
    ];
    
    const totalPoints = 60;
    for (let i = 0; i < totalPoints; i++) {
      const angle = (i / totalPoints) * 2 * Math.PI;
      const idx = i % centerPoints.length;
      
      points.push({
        x: centerPoints[idx].x + baseRadius * Math.cos(angle),
        y: centerPoints[idx].y + baseRadius * Math.sin(angle)
      });
    }
  } else {
    // Regular polygon
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * 2 * Math.PI;
      points.push({
        x: center.x + size * Math.cos(angle),
        y: center.y + size * Math.sin(angle)
      });
    }
  }
  
  // Return shape data
  res.json({
    status: 'success',
    shape: {
      type: shapeType,
      points: points,
      color: color || getRandomColor(),
      id: `shape-${Date.now()}`
    }
  });
});

function getRandomColor() {
  const colors = [
    '#3498db', // blue
    '#2ecc71', // green
    '#e74c3c', // red
    '#f39c12', // orange
    '#9b59b6', // purple
    '#1abc9c', // teal
    '#34495e'  // dark blue
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Shape generation API running on port ${PORT}`);
  console.log(`API_KEY status: ${process.env.GEMINI_API_KEY ? 'Available' : 'Missing'}`);
});