import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI - you would need to provide your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Processes text commands to generate shape data
 * @param {string} text - The user's text command
 * @returns {Object} - Shape data including type, points, color
 */
export async function createShapeFromText(text) {
  // 1. Use AI to interpret the command
  const shapeInfo = await extractShapeInfoFromText(text);
  
  // 2. Generate points for the shape based on the AI interpretation
  const points = generateShapePoints(shapeInfo);
  
  // 3. Return shape data with the extracted color
  return {
    type: shapeInfo.shapeName,
    points,
    color: shapeInfo.color || getRandomColor(),
    id: `shape-${Date.now()}`
  };
}

/**
 * Use Gemini AI to extract shape information from text command
 */
async function extractShapeInfoFromText(text) {
  try {
    // Create a Gemini model instance
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Prepare the prompt for shape extraction
    const prompt = `
      Extract shape information from this command: "${text}"
      
      Return a structured response with these properties:
      - shapeName: The name of the shape (e.g., "star", "heart", "hexagon")
      - sides: Number of sides if applicable
      - color: Color name if specified
      - size: Size descriptor if specified (small, medium, large)
      - modifiers: Any special properties (e.g., "rounded", "dotted")
      
      Format your response exactly like this example:
      {
        "shapeName": "triangle",
        "sides": 3,
        "color": "blue",
        "size": "medium",
        "modifiers": ["rounded"]
      }
    `;
    
    // Get response from Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    // Parse the JSON response
    // First, find the JSON object in the response text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("No valid JSON found in the response");
    }
    
    const shapeParsed = JSON.parse(jsonMatch[0]);
    
    // Handle defaults
    return {
      shapeName: shapeParsed.shapeName || "polygon",
      sides: shapeParsed.sides || 4,
      color: shapeParsed.color || null,
      size: shapeParsed.size || "medium",
      modifiers: shapeParsed.modifiers || []
    };
  } catch (error) {
    console.error("Error parsing shape with Gemini AI:", error);
    
    // Fallback to basic parsing if AI fails
    return basicShapeParsing(text);
  }
}

/**
 * Basic parsing as fallback if AI service fails
 */
function basicShapeParsing(text) {
  const lowerText = text.toLowerCase();
  
  // Simple keyword extraction
  const commonShapes = {
    "triangle": { shapeName: "triangle", sides: 3 },
    "square": { shapeName: "square", sides: 4 },
    "rectangle": { shapeName: "rectangle", sides: 4 },
    "pentagon": { shapeName: "pentagon", sides: 5 },
    "hexagon": { shapeName: "hexagon", sides: 6 },
    "octagon": { shapeName: "octagon", sides: 8 },
    "circle": { shapeName: "circle", sides: 32 }, // Approximation
    "star": { shapeName: "star", sides: 10 }, // Special case
    "heart": { shapeName: "heart", sides: 30 }, // Special case
  };
  
  // Find shape in text
  let shape = null;
  for (const [shapeName, shapeInfo] of Object.entries(commonShapes)) {
    if (lowerText.includes(shapeName)) {
      shape = shapeInfo;
      break;
    }
  }
  
  // Extract color if present
  const colorMap = {
    "red": "#e74c3c",
    "blue": "#3498db",
    "green": "#2ecc71",
    "yellow": "#f1c40f",
    "purple": "#9b59b6",
    "black": "#34495e",
    "white": "#ecf0f1",
    "orange": "#f39c12",
    "pink": "#e84393",
    "brown": "#795548",
    "gray": "#95a5a6",
    "teal": "#1abc9c"
  };
  
  let color = null;
  for (const [colorName, colorHex] of Object.entries(colorMap)) {
    if (lowerText.includes(colorName)) {
      color = colorHex;
      break;
    }
  }
  
  // Default to a random polygon if no shape found
  if (!shape) {
    shape = {
      shapeName: "polygon",
      sides: Math.floor(Math.random() * 6) + 3, // 3-8 sides
    };
  }
  
  return {
    ...shape,
    color,
    size: lowerText.includes("small") ? "small" : 
          lowerText.includes("large") ? "large" : "medium",
    modifiers: []
  };
}

/**
 * Generate points for a shape based on extracted information
 */
function generateShapePoints(shapeInfo) {
  const center = { x: 150, y: 150 };
  
  // Determine size in pixels
  const sizeMap = {
    "small": 50,
    "medium": 80,
    "large": 120
  };
  const size = sizeMap[shapeInfo.size] || 80;
  
  // Special case for "star"
  if (shapeInfo.shapeName === "star") {
    const points = [];
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
    return points;
  }
  
  // Special case for "heart"
  if (shapeInfo.shapeName === "heart") {
    const points = [];
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * 2 * Math.PI;
      const heartX = 16 * Math.pow(Math.sin(angle), 3);
      const heartY = 13 * Math.cos(angle) - 5 * Math.cos(2*angle) - 2 * Math.cos(3*angle) - Math.cos(4*angle);
      points.push({
        x: center.x + heartX * (size / 16),
        y: center.y - heartY * (size / 16)
      });
    }
    return points;
  }
  
  // Special case for "cloud"
  if (shapeInfo.shapeName === "cloud") {
    // Create a cloud using multiple circles
    const baseRadius = size / 3;
    const circlePositions = [
      { x: center.x - baseRadius, y: center.y - baseRadius/2 },
      { x: center.x + baseRadius, y: center.y - baseRadius/2 },
      { x: center.x - baseRadius*1.5, y: center.y + baseRadius/2 },
      { x: center.x, y: center.y + baseRadius/2 },
      { x: center.x + baseRadius*1.5, y: center.y + baseRadius/2 }
    ];
    
    // Generate points to approximate the cloud shape
    const points = [];
    const totalPoints = 60;
    
    for (let i = 0; i < totalPoints; i++) {
      const angle = (i / totalPoints) * 2 * Math.PI;
      
      // Find the closest circle center
      let minDist = Infinity;
      let closestCenter = circlePositions[0];
      
      circlePositions.forEach(pos => {
        const testX = center.x + baseRadius * Math.cos(angle);
        const testY = center.y + baseRadius * Math.sin(angle);
        const dist = Math.sqrt(Math.pow(pos.x - testX, 2) + Math.pow(pos.y - testY, 2));
        
        if (dist < minDist) {
          minDist = dist;
          closestCenter = pos;
        }
      });
      
      points.push({
        x: closestCenter.x + baseRadius * Math.cos(angle),
        y: closestCenter.y + baseRadius * Math.sin(angle)
      });
    }
    
    // Sort points by angle for smoother shape
    return sortPointsByAngle(points, center);
  }
  
  // Special case for complex shapes like "arrow"
  if (shapeInfo.shapeName === "arrow") {
    // Create an arrow pointing right
    return [
      { x: center.x - size, y: center.y - size/4 },
      { x: center.x - size/4, y: center.y - size/4 },
      { x: center.x - size/4, y: center.y - size/2 },
      { x: center.x + size, y: center.y },
      { x: center.x - size/4, y: center.y + size/2 },
      { x: center.x - size/4, y: center.y + size/4 },
      { x: center.x - size, y: center.y + size/4 }
    ];
  }
  
  // Regular polygon
  const sides = shapeInfo.sides || 4;
  const points = [];
  
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * 2 * Math.PI;
    points.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle)
    });
  }
  
  return points;
}

/**
 * Sort points in clockwise order around a center
 */
function sortPointsByAngle(points, center) {
  return points.sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x);
    const angleB = Math.atan2(b.y - center.y, b.x - center.x);
    return angleA - angleB;
  });
}

/**
 * Generate a random color
 */
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