import { useState, useEffect } from 'react';

const VoiceCommands = ({ onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('Voice commands inactive');
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableShapes, setAvailableShapes] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);

  // API configuration - replace with your actual key
  const GEMINI_API_KEY = "AIzaSyC1GybTjiD6wyRKK7beet_ZY-MCsN9GAvo"; // Replace this with your actual Gemini API key
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  useEffect(() => {
    // Fetch available shapes when component mounts
    fetchAvailableShapes();
    
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage('Listening for shape commands...');
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setStatusMessage(`Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatusMessage('Voice recognition stopped');
    };

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptText = result[0].transcript;
      
      setTranscript(transcriptText);
      
      // Process commands if we have a final result
      if (result.isFinal) {
        processVoiceCommand(transcriptText);
      }
    };

    // Start/stop recognition based on isListening state
    if (isListening) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Recognition already started', error);
      }
    } else {
      try {
        recognition.stop();
      } catch (error) {
        console.error('Recognition already stopped', error);
      }
    }

    // Cleanup
    return () => {
      try {
        recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition during cleanup', error);
      }
    };
  }, [isListening]);

  // Function to fetch available shapes
  const fetchAvailableShapes = async () => {
    try {
      // You could replace this with an actual API call if your shapes come from a database
      const shapes = ['rectangle', 'circle', 'triangle', 'star', 'hexagon', 
                      'octagon', 'pentagon', 'heart', 'arrow', 'cloud', 'diamond', 
                      'crescent', 'cross', 'spiral', 'wave', 'ellipse'];
      
      setAvailableShapes(shapes);
    } catch (error) {
      console.error('Error fetching available shapes:', error);
      setStatusMessage('Error connecting to shape service');
    }
  };

  // Process voice command through Gemini API
  const processVoiceCommand = async (text) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setStatusMessage('Processing your voice command...');
    
    try {
      // First pass quick check for simple commands to improve response time
      if (text.toLowerCase().includes('stop listening')) {
        setIsListening(false);
        setStatusMessage('Voice recognition stopped by command');
        return;
      }
      
      // Add to command history for context
      const updatedHistory = [...commandHistory, text];
      if (updatedHistory.length > 5) updatedHistory.shift(); // Keep last 5 commands
      setCommandHistory(updatedHistory);
      
      // Use Gemini to interpret the command
      const interpretation = await interpretCommandWithGemini(text);
      
      // Execute the interpreted command
      await executeCommand(interpretation);
    } catch (error) {
      console.error('Error processing voice command:', error);
      setStatusMessage('Failed to process voice command');
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to call Gemini API to interpret the command
  const interpretCommandWithGemini = async (text) => {
    try {
      // Construct a prompt that helps Gemini understand how to interpret the command
      const prompt = `
        Interpret the following voice command for a shape drawing application: "${text}"
        
        Available shapes: ${availableShapes.join(', ')}
        
        Previous commands for context: ${commandHistory.join('; ')}
        
        Return a JSON structure with the following format:
        {
          "commandType": "one of: create_shape, modify_shape, delete_shape, generate_moodboard, other",
          "shapeType": "the requested shape type if applicable",
          "color": "requested color name or hex code if specified",
          "size": "small, medium, large, or specific size if mentioned",
          "position": "where to place it if specified",
          "rotation": "any rotation specified in degrees",
          "specialAttributes": "any special characteristics mentioned",
          "confidence": "how confident you are in this interpretation (0-1)"
        }
        
        Be very precise with the shapeType field - use exactly one of the available shapes that best matches what was requested.
        For polygons like pentagon, hexagon, octagon, etc., be sure to correctly identify these.
        
        Respond with only the valid JSON structure and nothing else.
      `;
      
      // Make the actual API call to Gemini
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
      }
      
      const responseData = await response.json();
      
      // Extract the text from Gemini's response
      const generatedText = responseData.candidates[0].content.parts[0].text;
      
      // Parse the JSON from the response
      try {
        const jsonMatch = generatedText.match(/({[\s\S]*})/); // Extract JSON if it's wrapped in text
        const jsonStr = jsonMatch ? jsonMatch[0] : generatedText;
        
        // Parse the JSON
        const interpretation = JSON.parse(jsonStr);
        
        // Add default values for any missing fields
        const result = {
          commandType: interpretation.commandType || "create_shape",
          shapeType: interpretation.shapeType || "circle",
          color: interpretation.color || "#3498db",
          size: interpretation.size || "medium",
          position: interpretation.position || "center",
          rotation: interpretation.rotation || "0deg",
          specialAttributes: interpretation.specialAttributes || "",
          confidence: interpretation.confidence || 0.7
        };
        
        return result;
      } catch (jsonError) {
        console.error('Error parsing JSON from API response:', jsonError);
        
        // Fallback interpretation when JSON parsing fails
        return getFallbackInterpretation(text);
      }
      
    } catch (error) {
      console.error('Error interpreting command with Gemini:', error);
      return getFallbackInterpretation(text);
    }
  };

  // Fallback function if API fails
  const getFallbackInterpretation = (text) => {
    const lowerText = text.toLowerCase();
    
    // Improved keyword detection
    let commandType = "create_shape";
    if (lowerText.includes("delete") || lowerText.includes("remove")) {
      commandType = "delete_shape";
    } else if (lowerText.includes("change color") || lowerText.includes("set color") || 
               lowerText.includes("make it") || lowerText.includes("modify")) {
      commandType = "modify_shape";
    } else if (lowerText.includes("moodboard")) {
      commandType = "generate_moodboard";
    }
    
    // Enhanced shape detection - check for specific polygon names
    let shapeType = "circle"; // default
    
    // Check for common polygons with specific sides
    const polygonMatches = {
      "triangle": 3,
      "rectangle": 4,
      "square": 4,
      "pentagon": 5,
      "hexagon": 6,
      "heptagon": 7,
      "octagon": 8,
      "nonagon": 9,
      "decagon": 10
    };
    
    // First check for explicit polygon names
    for (const [polygon, _] of Object.entries(polygonMatches)) {
      if (lowerText.includes(polygon)) {
        shapeType = polygon;
        break;
      }
    }
    
    // If no explicit polygon name found, check for "-gon" or "-sided" patterns
    if (shapeType === "circle") {
      for (const shape of availableShapes) {
        if (lowerText.includes(shape)) {
          shapeType = shape;
          break;
        }
      }
      
      // Check for "X-sided" or "X sided" patterns
      const sidedMatch = lowerText.match(/(\d+)[- ]sided/);
      if (sidedMatch) {
        const sides = parseInt(sidedMatch[1], 10);
        if (sides === 3) shapeType = "triangle";
        else if (sides === 4) shapeType = "square";
        else if (sides === 5) shapeType = "pentagon";
        else if (sides === 6) shapeType = "hexagon"; 
        else if (sides === 8) shapeType = "octagon";
      }
    }
    
    // Extract likely color
    const colorMap = {
      "red": "#e74c3c",
      "blue": "#3498db",
      "green": "#2ecc71", 
      "yellow": "#f1c40f",
      "purple": "#9b59b6",
      "black": "#34495e",
      "white": "#ecf0f1",
      "orange": "#f39c12",
      "pink": "#e84393"
    };
    
    let color = "#3498db"; // default blue
    for (const [colorName, colorHex] of Object.entries(colorMap)) {
      if (lowerText.includes(colorName)) {
        color = colorHex;
        break;
      }
    }
    
    // Extract size if mentioned
    let size = "medium";
    if (lowerText.includes("large") || lowerText.includes("big")) {
      size = "large";
    } else if (lowerText.includes("small") || lowerText.includes("tiny")) {
      size = "small";
    }
    
    return {
      commandType,
      shapeType,
      color,
      size,
      position: lowerText.includes("center") ? "center" : "random",
      rotation: "0deg",
      specialAttributes: "",
      confidence: 0.6
    };
  };

  // Function to execute the interpreted command
  const executeCommand = async (interpretation) => {
    setStatusMessage(`Executing: ${interpretation.commandType} for ${interpretation.shapeType}`);
    
    try {
      switch (interpretation.commandType) {
        case 'create_shape':
          await generateShape(interpretation);
          break;
          
        case 'delete_shape':
          onCommand({
            action: 'delete_element',
            data: { target: interpretation.shapeType }
          });
          setStatusMessage(`Deleted ${interpretation.shapeType || 'selected shape'}`);
          break;
          
        case 'modify_shape':
          onCommand({
            action: 'modify_element',
            data: { 
              target: interpretation.shapeType,
              color: interpretation.color,
              size: interpretation.size,
              rotation: interpretation.rotation
            }
          });
          setStatusMessage(`Modified ${interpretation.shapeType || 'selected shape'}`);
          break;
          
        case 'generate_moodboard':
          onCommand({
            action: 'generate_moodboard',
            data: { theme: transcript }
          });
          setStatusMessage('Generating moodboard based on your request');
          break;
          
        default:
          setStatusMessage("I'm not sure how to process that voice command");
      }
    } catch (error) {
      console.error('Error executing command:', error);
      setStatusMessage('Failed to execute command');
    }
  };

  // Function to generate a shape based on interpretation
  const generateShape = async (interpretation) => {
    setStatusMessage(`Creating a ${interpretation.color.replace('#', '')} ${interpretation.shapeType}...`);
    
    try {
      // Scale factor based on interpreted size
      const sizeScale = interpretation.size === 'large' ? 1.5 :
                       interpretation.size === 'small' ? 0.7 : 1.0;
      
      // Base position
      const center = { x: 100, y: 100 };
      const size = 80 * sizeScale;
      
      // Generate shape points
      const points = generateShapePoints(interpretation.shapeType, center, size);
      
      onCommand({
        action: 'add_custom_shape',
        data: {
          type: interpretation.shapeType,
          points: points,
          color: interpretation.color,
          id: `shape-${Date.now()}`,
          specialAttributes: interpretation.specialAttributes,
          rotation: interpretation.rotation
        }
      });
      
      setStatusMessage(`Created a ${interpretation.shapeType}!`);
    } catch (error) {
      console.error('Error generating shape:', error);
      setStatusMessage('Failed to create shape');
    }
  };

  // Improved function to generate points for different shapes
  const generateShapePoints = (shapeName, center, size) => {
    // Handle special shapes first
    if (shapeName === 'star') {
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
    } else if (shapeName === 'heart') {
      // Heart shape approximation
      const points = [];
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * 2 * Math.PI;
        const heartX = 16 * Math.pow(Math.sin(angle), 3);
        const heartY = 13 * Math.cos(angle) - 5 * Math.cos(2*angle) - 2 * Math.cos(3*angle) - Math.cos(4*angle);
        points.push({
          x: center.x + heartX * 5,
          y: center.y - heartY * 5
        });
      }
      return points;
    } else if (shapeName === 'diamond') {
      return [
        { x: center.x, y: center.y - size },
        { x: center.x + size, y: center.y },
        { x: center.x, y: center.y + size },
        { x: center.x - size, y: center.y }
      ];
    } else if (shapeName === 'rectangle') {
      return [
        { x: center.x - size/2, y: center.y - size/3 },
        { x: center.x + size/2, y: center.y - size/3 },
        { x: center.x + size/2, y: center.y + size/3 },
        { x: center.x - size/2, y: center.y + size/3 }
      ];
    } else if (shapeName === 'triangle') {
      return [
        { x: center.x, y: center.y - size },
        { x: center.x + size, y: center.y + size },
        { x: center.x - size, y: center.y + size }
      ];
    } else if (shapeName === 'circle' || shapeName === 'ellipse') {
      // Approximate circle with many sides
      const points = [];
      const sides = 32;
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * 2 * Math.PI;
        const radiusX = shapeName === 'ellipse' ? size * 1.5 : size;
        const radiusY = size;
        points.push({
          x: center.x + radiusX * Math.cos(angle),
          y: center.y + radiusY * Math.sin(angle)
        });
      }
      return points;
    }
    
    // Handle regular polygons - now with proper mapping for named polygons
    const polygonSidesMap = {
      'triangle': 3,
      'square': 4,
      'pentagon': 5,
      'hexagon': 6,
      'heptagon': 7,
      'octagon': 8,
      'nonagon': 9,
      'decagon': 10
    };
    
    // Get number of sides from the map, or extract from the shape name
    let sides = 4; // Default to square if unknown
    
    if (polygonSidesMap[shapeName]) {
      sides = polygonSidesMap[shapeName];
    } else if (shapeName.includes('gon')) {
      // Try to extract number from names like "5-gon" or "polygon with 6 sides"
      const match = shapeName.match(/(\d+)[- ]gon/);
      if (match) {
        sides = parseInt(match[1], 10);
      }
    }
    
    // Generate regular polygon points
    const points = [];
    // Start from the top for consistent orientation
    const startAngle = -Math.PI / 2;
    
    for (let i = 0; i < sides; i++) {
      const angle = startAngle + (i / sides) * 2 * Math.PI;
      points.push({
        x: center.x + size * Math.cos(angle),
        y: center.y + size * Math.sin(angle)
      });
    }
    
    return points;
  };

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isListening ? (isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400 animate-pulse') : 'bg-red-400'
          }`}></div>
          {statusMessage}
        </div>
        <button
          onClick={toggleListening}
          className={`px-4 py-2 rounded text-sm ${
            isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          } transition-colors`}
          disabled={isProcessing}
        >
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
      </div>
      
      {isListening && (
        <div className="p-3 bg-gray-800 rounded text-sm max-h-24 overflow-y-auto mb-2">
          {transcript || 'Speak a command...'}
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-400">
        <p>Try saying: "Create a large red star" or "Draw a blue pentagon in the center"</p>
        <p>Available shapes: {availableShapes.slice(0, 6).join(', ')}, and more...</p>
      </div>
    </div>
  );
};

export default VoiceCommands;