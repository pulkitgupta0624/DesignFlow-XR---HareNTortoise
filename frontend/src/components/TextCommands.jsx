import { useState, useEffect } from 'react';

const TextCommands = ({ onCommand }) => {
  const [commandText, setCommandText] = useState('');
  const [statusMessage, setStatusMessage] = useState('AI-powered text commands ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableShapes, setAvailableShapes] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  
  // API configuration - replace with your actual key
  const GEMINI_API_KEY = "AIzaSyC1GybTjiD6wyRKK7beet_ZY-MCsN9GAvo"; // Replace this with your actual Gemini API key
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  // Fetch available shapes when component mounts
  useEffect(() => {
    fetchAvailableShapes();
  }, []);

  // Function to fetch available shapes
  const fetchAvailableShapes = async () => {
    try {
      // You could replace this with an actual API call if your shapes come from a database
      const shapes = ['rectangle', 'circle', 'triangle', 'star', 'hexagon', 
                      'octagon', 'heart', 'arrow', 'cloud', 'diamond', 
                      'crescent', 'cross', 'spiral', 'wave', 'ellipse'];
      
      setAvailableShapes(shapes);
      setStatusMessage('AI shape generator ready! Ask for any shape you can imagine.');
    } catch (error) {
      console.error('Error fetching available shapes:', error);
      setStatusMessage('Error connecting to AI service');
    }
  };

  const handleInputChange = (e) => {
    setCommandText(e.target.value);
  };

  // Function to call Gemini API to interpret the command
  const interpretCommandWithGemini = async (text) => {
    setIsProcessing(true);
    setStatusMessage('Processing your request...');
    
    try {
      // Add to command history for context
      const updatedHistory = [...commandHistory, text];
      if (updatedHistory.length > 5) updatedHistory.shift(); // Keep last 5 commands for context
      setCommandHistory(updatedHistory);
      
      // Construct a prompt that helps Gemini understand how to interpret the command
      const prompt = `
        Interpret the following user command for a shape drawing application: "${text}"
        
        Available shapes: ${availableShapes.join(', ')}
        
        Previous commands for context: ${updatedHistory.join('; ')}
        
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
      // The try/catch is needed because the API might not return valid JSON
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
        return {
          commandType: "create_shape",
          shapeType: text.includes("circle") ? "circle" : 
                    text.includes("triangle") ? "triangle" : 
                    text.includes("star") ? "star" : "circle",
          color: text.includes("red") ? "#e74c3c" : 
                text.includes("blue") ? "#3498db" : 
                text.includes("green") ? "#2ecc71" : "#3498db",
          size: text.includes("large") ? "large" : 
               text.includes("small") ? "small" : "medium",
          position: "center",
          rotation: "0deg",
          specialAttributes: "",
          confidence: 0.5
        };
      }
      
    } catch (error) {
      console.error('Error interpreting command with Gemini:', error);
      
      // Provide a fallback interpretation
      return {
        commandType: "create_shape",
        shapeType: "circle",
        color: "#3498db",
        size: "medium",
        position: "center",
        rotation: "0deg",
        specialAttributes: "",
        confidence: 0.3
      };
    } finally {
      setIsProcessing(false);
    }
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
            data: { theme: commandText }
          });
          setStatusMessage('Generating moodboard based on your request');
          break;
          
        default:
          setStatusMessage("I'm not sure how to process that request");
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
      
      // Base position - would be adjusted based on interpretation in a real app
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

  // Function to generate points for different shapes
  const generateShapePoints = (shapeName, center, size) => {
    // Special shapes
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
      // Diamond shape
      return [
        { x: center.x, y: center.y - size },
        { x: center.x + size, y: center.y },
        { x: center.x, y: center.y + size },
        { x: center.x - size, y: center.y }
      ];
    } else if (shapeName === 'crescent') {
      // Crescent moon shape
      const points = [];
      const outerRadius = size;
      const innerRadius = size * 0.7;
      const offset = size * 0.3;
      
      // Outer arc
      for (let i = 0; i <= 15; i++) {
        const angle = (i / 15) * Math.PI;
        points.push({
          x: center.x + outerRadius * Math.sin(angle),
          y: center.y + outerRadius * Math.cos(angle)
        });
      }
      
      // Inner arc (offset)
      for (let i = 15; i >= 0; i--) {
        const angle = (i / 15) * Math.PI;
        points.push({
          x: center.x + offset + innerRadius * Math.sin(angle),
          y: center.y + innerRadius * Math.cos(angle)
        });
      }
      
      return points;
    } else if (shapeName === 'spiral') {
      // Simple spiral approximation
      const points = [];
      const turns = 3;
      const pointCount = 60;
      
      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * 2 * Math.PI * turns;
        const radius = (i / pointCount) * size;
        points.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle)
        });
      }
      
      return points;
    } else if (shapeName === 'wave') {
      // Sine wave
      const points = [];
      const amplitude = size / 2;
      const frequency = 3;
      
      for (let i = 0; i < 30; i++) {
        const x = center.x - size + (i / 29) * size * 2;
        const y = center.y + amplitude * Math.sin((i / 29) * Math.PI * frequency);
        points.push({ x, y });
      }
      
      return points;
    }
    
    // Fallback to standard polygon generation
    const sides = shapeName === 'triangle' ? 3 : 
                 shapeName === 'square' ? 4 :
                 shapeName === 'rectangle' ? 4 :
                 shapeName === 'pentagon' ? 5 :
                 shapeName === 'hexagon' ? 6 :
                 shapeName === 'heptagon' ? 7 :
                 shapeName === 'octagon' ? 8 :
                 shapeName === 'circle' ? 32 : // Approximate circle with many sides
                 shapeName === 'ellipse' ? 32 :
                 Math.floor(Math.random() * 6) + 3; // Random 3-8 sides for custom
    
    // Special case for rectangle
    if (shapeName === 'rectangle') {
      return [
        { x: center.x - size/2, y: center.y - size/3 },
        { x: center.x + size/2, y: center.y - size/3 },
        { x: center.x + size/2, y: center.y + size/3 },
        { x: center.x - size/2, y: center.y + size/3 }
      ];
    }
    
    // Special case for ellipse
    if (shapeName === 'ellipse') {
      const points = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * 2 * Math.PI;
        points.push({
          x: center.x + size * 1.5 * Math.cos(angle),
          y: center.y + size * 0.75 * Math.sin(angle)
        });
      }
      return points;
    }
    
    // Regular polygon
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * 2 * Math.PI;
      points.push({
        x: center.x + size * Math.cos(angle),
        y: center.y + size * Math.sin(angle)
      });
    }
    
    return points;
  };

  const processCommand = async () => {
    if (!commandText.trim()) {
      setStatusMessage('Please enter a command');
      return;
    }

    try {
      // Use Gemini to interpret the command
      const interpretation = await interpretCommandWithGemini(commandText);
      
      // Execute the interpreted command
      await executeCommand(interpretation);
      
      // Clear command text after processing
      setCommandText('');
    } catch (error) {
      console.error('Error processing command:', error);
      setStatusMessage('Failed to process command');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      processCommand();
    }
  };

  // Example commands to show users
  const exampleCommands = [
    "Draw a large red star in the center",
    "Create a glowing blue heart",
    "Make a small green pentagon",
    "Draw a spiral pattern with purple color", 
    "Create a yellow crescent moon"
  ];

  // Randomly select example commands to display
  const getRandomExamples = (count = 2) => {
    const shuffled = [...exampleCommands].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const examples = getRandomExamples();

  return (
    <div className="w-full">
      <div className="text-sm mb-2 flex items-center">
        <div className={`w-2 h-2 rounded-full mr-2 ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
        {statusMessage}
      </div>
      
      <div className="flex">
        <input
          type="text"
          value={commandText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type what you want to create..."
          className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-l text-sm"
          disabled={isProcessing}
        />
        <button
          onClick={processCommand}
          className={`px-4 py-2 ${isProcessing ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} rounded-r text-sm transition-colors`}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Create'}
        </button>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">
        <p>Examples: "{examples[0]}" or "{examples[1]}"</p>
      </div>
    </div>
  );
};

export default TextCommands;