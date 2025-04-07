import React, { useRef, useEffect, useState, useCallback } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

const GestureDetector = ({
  onGestureDetected,
  selectedElement,
  onResizeElement,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [label, setLabel] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const latestResultsRef = useRef(null);
  const cameraRef = useRef(null);
  const animationRef = useRef(null);
  const processingFrameRef = useRef(false);
  const handDetectorRef = useRef(null);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  // Pinch state for resizing
  const isPinchingRef = useRef(false);
  const pinchStartPositionRef = useRef(null);
  const pinchStartElementRef = useRef(null);
  const pinchCornerRef = useRef(null);
  
  // Improved smoothing data with larger buffer
  const positionBufferRef = useRef([]);
  const MAX_BUFFER_SIZE = 8; // Increased buffer size for smoother movement
  
  // Throttling with reduced update rate
  const lastUpdateTimeRef = useRef(0);
  const UPDATE_INTERVAL = 50; // ~20fps - less updates for smoother appearance
  
  // Frame skipping for processing - skip more frames
  const frameSkipCountRef = useRef(0);
  const FRAMES_TO_SKIP = 2; // Process every third frame

  // Gesture confidence tracking
  const gestureConfidenceRef = useRef(0);
  const CONFIDENCE_THRESHOLD = 3;
  
  // Exponential moving average weight
  const EMA_ALPHA = 0.3; // Lower = smoother but more latency

  // Debounce function
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Enhanced position smoothing using exponential moving average
  const smoothPosition = useCallback((newPosition) => {
    if (!newPosition) return null;
    
    const buffer = positionBufferRef.current;
    
    // Add new position to buffer
    buffer.push(newPosition);
    
    // Keep buffer at max size
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }
    
    // If buffer is empty, return the new position
    if (buffer.length <= 1) return newPosition;
    
    // Apply exponential moving average for smoother transitions
    let smoothX = newPosition.x;
    let smoothY = newPosition.y;
    
    // Skip the newest position (already included above) and apply weighted averaging
    for (let i = buffer.length - 2; i >= 0; i--) {
      const weight = Math.pow(1 - EMA_ALPHA, buffer.length - i - 1) * EMA_ALPHA;
      smoothX = smoothX * (1 - weight) + buffer[i].x * weight;
      smoothY = smoothY * (1 - weight) + buffer[i].y * weight;
    }
    
    return {
      x: smoothX,
      y: smoothY
    };
  }, []);

  // Process hand results
  const processHandResults = useCallback((results) => {
    try {
      // Check for throttling
      const now = performance.now();
      if (now - lastUpdateTimeRef.current < UPDATE_INTERVAL) {
        return;
      }
      lastUpdateTimeRef.current = now;
      
      // Store results
      latestResultsRef.current = results;

      // Get stage dimensions for proper scaling
      const stageWidth = window.innerWidth * 0.6;
      const stageHeight = window.innerHeight - 80;
      const canvas = canvasRef.current;

      if (!canvas) return;

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0]; // Using primary hand
        gestureConfidenceRef.current = Math.min(gestureConfidenceRef.current + 1, CONFIDENCE_THRESHOLD + 5);

        if (landmarks && landmarks[4] && landmarks[8]) {
          const thumb = landmarks[4];
          const index = landmarks[8];

          // Calculate distance between thumb and index finger
          const dx = (index.x - thumb.x) * canvas.width;
          const dy = (index.y - thumb.y) * canvas.height;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Pinch detection threshold
          const pinchThreshold = 15;

          // Check if pinching - only when confidence is high enough
          if (distance < pinchThreshold && gestureConfidenceRef.current >= CONFIDENCE_THRESHOLD) {
            // Fix mirroring by calculating correct position
            const centerX = 1 - (thumb.x + index.x) / 2; // Mirror horizontally
            const centerY = (thumb.y + index.y) / 2;

            // Scale from canvas size to actual stage size
            const scaledX = centerX * stageWidth;
            const scaledY = centerY * stageHeight;

            // Create smoothed position
            const position = { x: scaledX, y: scaledY };
            const smoothedPosition = smoothPosition(position);

            if (!smoothedPosition) return;

            if (!isPinchingRef.current) {
              // Start pinching
              isPinchingRef.current = true;
              pinchStartPositionRef.current = smoothedPosition;
              
              // Deep copy the selectedElement with null checks
              if (selectedElement && 
                  typeof selectedElement === 'object' && 
                  selectedElement !== null) {
                pinchStartElementRef.current = {
                  ...selectedElement,
                  x: selectedElement.x || 0,
                  y: selectedElement.y || 0,
                  width: selectedElement.width || 100,
                  height: selectedElement.height || 100
                };

                // Determine which corner is being pinched
                const corners = [
                  { x: pinchStartElementRef.current.x, y: pinchStartElementRef.current.y }, // Top-left
                  {
                    x: pinchStartElementRef.current.x + pinchStartElementRef.current.width,
                    y: pinchStartElementRef.current.y,
                  }, // Top-right
                  {
                    x: pinchStartElementRef.current.x,
                    y: pinchStartElementRef.current.y + pinchStartElementRef.current.height,
                  }, // Bottom-left
                  {
                    x: pinchStartElementRef.current.x + pinchStartElementRef.current.width,
                    y: pinchStartElementRef.current.y + pinchStartElementRef.current.height,
                  }, // Bottom-right
                ];

                // Find the closest corner to the pinch position
                let closestCorner = 0;
                let minDistance = Number.MAX_VALUE;

                corners.forEach((corner, index) => {
                  const dist = Math.sqrt(
                    Math.pow(smoothedPosition.x - corner.x, 2) +
                      Math.pow(smoothedPosition.y - corner.y, 2)
                  );

                  if (dist < minDistance) {
                    minDistance = dist;
                    closestCorner = index;
                  }
                });

                pinchCornerRef.current = closestCorner;
                setLabel(`Pinching corner ${closestCorner}`);
                
                try {
                  window.dispatchEvent(new CustomEvent('gesture_detected', {
                    bubbles: true,
                    detail: {
                      type: 'pinch_start',
                      position: smoothedPosition,
                      corner: closestCorner
                    }
                  }));
                  
                  if (onGestureDetected && typeof onGestureDetected === 'function') {
                    onGestureDetected("pinch_start", smoothedPosition);
                  }
                } catch (err) {
                  console.warn("Event dispatch error:", err);
                }
              }
            } else {
              // Continue pinching - track movement
              if (!pinchStartPositionRef.current) {
                pinchStartPositionRef.current = smoothedPosition;
                return;
              }
              
              const deltaX = smoothedPosition.x - pinchStartPositionRef.current.x;
              const deltaY = smoothedPosition.y - pinchStartPositionRef.current.y;

              // Check if we have all the necessary data to perform resize
              if (
                selectedElement && 
                pinchCornerRef.current !== null && 
                pinchStartElementRef.current && 
                typeof pinchCornerRef.current === 'number'
              ) {
                // Start with the original element dimensions
                const startElement = pinchStartElementRef.current;
                
                if (!startElement.width || !startElement.height || 
                    startElement.x === undefined || startElement.y === undefined) {
                  return;
                }
                
                // Resize the element based on the corner being pinched
                let newWidth = startElement.width;
                let newHeight = startElement.height;
                let newX = startElement.x;
                let newY = startElement.y;

                try {
                  switch (pinchCornerRef.current) {
                    case 0: // Top-left
                      newWidth = Math.max(30, startElement.width - deltaX);
                      newHeight = Math.max(30, startElement.height - deltaY);
                      newX = startElement.x + (startElement.width - newWidth);
                      newY = startElement.y + (startElement.height - newHeight);
                      break;
                    case 1: // Top-right
                      newWidth = Math.max(30, startElement.width + deltaX);
                      newHeight = Math.max(30, startElement.height - deltaY);
                      newY = startElement.y + (startElement.height - newHeight);
                      break;
                    case 2: // Bottom-left
                      newWidth = Math.max(30, startElement.width - deltaX);
                      newHeight = Math.max(30, startElement.height + deltaY);
                      newX = startElement.x + (startElement.width - newWidth);
                      break;
                    case 3: // Bottom-right
                      newWidth = Math.max(30, startElement.width + deltaX);
                      newHeight = Math.max(30, startElement.height + deltaY);
                      break;
                    default:
                      return;
                  }
                } catch (err) {
                  console.warn("Resize calculation error:", err);
                  return;
                }

                if (isNaN(newWidth) || isNaN(newHeight) || isNaN(newX) || isNaN(newY)) {
                  return;
                }
                
                // Constraints to prevent extreme values
                newWidth = Math.min(Math.max(30, newWidth), window.innerWidth);
                newHeight = Math.min(Math.max(30, newHeight), window.innerHeight);
                
                const updatedElement = {
                  ...selectedElement,
                  x: newX,
                  y: newY,
                  width: newWidth,
                  height: newHeight,
                };
                
                if (onResizeElement && typeof onResizeElement === 'function') {
                  try {
                    onResizeElement(updatedElement);
                    
                    window.dispatchEvent(new CustomEvent('element_resize', {
                      bubbles: true,
                      detail: { element: updatedElement }
                    }));
                  } catch (err) {
                    console.warn("Resize event error:", err);
                  }
                }
              }
            }
          } else if (isPinchingRef.current) {
            // End pinching - add hysteresis to prevent jitter
            if (distance > pinchThreshold + 5) {
              isPinchingRef.current = false;
              pinchStartPositionRef.current = null;
              pinchStartElementRef.current = null;
              pinchCornerRef.current = null;
              setLabel("");
              
              try {
                window.dispatchEvent(new CustomEvent('gesture_detected', {
                  bubbles: true,
                  detail: { type: 'pinch_end' }
                }));
                
                if (onGestureDetected && typeof onGestureDetected === 'function') {
                  onGestureDetected("pinch_end");
                }
              } catch (err) {
                console.warn("Pinch end event error:", err);
              }
            }
          }

          // Handle cursor position (index finger tip as cursor)
          if (gestureConfidenceRef.current >= CONFIDENCE_THRESHOLD) {
            try {
              const cursorX = (1 - index.x) * stageWidth;
              const cursorY = index.y * stageHeight;
              
              const smoothedCursor = smoothPosition({ x: cursorX, y: cursorY });
              
              if (smoothedCursor) {
                try {
                  window.dispatchEvent(new CustomEvent('cursor_move', {
                    bubbles: true,
                    detail: { position: smoothedCursor }
                  }));
                  
                  if (onGestureDetected && typeof onGestureDetected === 'function') {
                    onGestureDetected("cursor_move", smoothedCursor);
                  }
                } catch (err) {
                  console.warn("Cursor move event error:", err);
                }
              }
            } catch (err) {
              console.warn("Cursor processing error:", err);
            }
          }
        }
      } else {
        // Decrease confidence when no hands detected, but do it gradually
        gestureConfidenceRef.current = Math.max(0, gestureConfidenceRef.current - 0.5);
        
        // Only end pinching when confidence is completely lost
        if (isPinchingRef.current && gestureConfidenceRef.current <= 0) {
          // End pinching if no hands detected
          isPinchingRef.current = false;
          pinchStartPositionRef.current = null;
          pinchStartElementRef.current = null;
          pinchCornerRef.current = null;
          setLabel("");
          
          try {
            window.dispatchEvent(new CustomEvent('gesture_detected', {
              bubbles: true,
              detail: { type: 'pinch_end' }
            }));
            
            if (onGestureDetected && typeof onGestureDetected === 'function') {
              onGestureDetected("pinch_end");
            }
          } catch (err) {
            console.warn("Pinch end event error (no hands):", err);
          }
        }
      }
    } catch (err) {
      console.warn("Process hand results error:", err);
    }
  }, [selectedElement, onGestureDetected, onResizeElement, smoothPosition]);

  // Render function
  const renderFrame = useCallback(() => {
    try {
      const results = latestResultsRef.current;
      const canvas = canvasRef.current;
      if (!canvas) {
        animationRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animationRef.current = requestAnimationFrame(renderFrame);
        return;
      }
      
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video feed with mirroring
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      if (results && results.image) {
        ctx.drawImage(
          results.image, 
          0, 
          0, 
          canvas.width, 
          canvas.height
        );
      }

      // Draw hand landmarks
      if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
          // Only draw thumb and index finger
          const keyPoints = [4, 8]; // thumb tip, index finger tip
          
          for (let i of keyPoints) {
            if (landmarks[i]) {
              const x = landmarks[i].x * canvas.width;
              const y = landmarks[i].y * canvas.height;
              ctx.beginPath();
              ctx.arc(x, y, 4, 0, 2 * Math.PI);
              ctx.fillStyle = "red";
              ctx.fill();
            }
          }

          const thumb = landmarks[4];
          const index = landmarks[8];
          
          if (thumb && index) {
            const dx = (index.x - thumb.x) * canvas.width;
            const dy = (index.y - thumb.y) * canvas.height;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 15) {
              ctx.beginPath();
              ctx.moveTo(thumb.x * canvas.width, thumb.y * canvas.height);
              ctx.lineTo(index.x * canvas.width, index.y * canvas.height);
              ctx.strokeStyle = "lime";
              ctx.lineWidth = 3;
              ctx.stroke();
            }
          }
        }
      }

      ctx.restore();
      
      // Draw text without transformation
      if (label) {
        ctx.font = "16px Arial";
        ctx.fillStyle = "yellow";
        ctx.fillText(label, 10, 20);
      }

      // Request next frame
      animationRef.current = requestAnimationFrame(renderFrame);
    } catch (err) {
      console.warn("Render frame error:", err);
      animationRef.current = requestAnimationFrame(renderFrame);
    }
  }, []);

  // Initialize camera and hands with stability fixes
  const initializeCamera = useCallback(async () => {
    // If already initializing, don't do it again
    if (initializingRef.current) return;
    
    initializingRef.current = true;
    
    try {
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.warn("Error stopping previous camera instance:", e);
        }
        cameraRef.current = null;
      }

      if (handDetectorRef.current) {
        try {
          handDetectorRef.current.close();
        } catch (e) {
          console.warn("Error closing previous hands instance:", e);
        }
        handDetectorRef.current = null;
      }

      // Safety check to avoid re-initialization after unmount
      if (!mountedRef.current) {
        initializingRef.current = false;
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        initializingRef.current = false;
        return;
      }

      // Lower resolution for better performance
      canvas.width = 160;  // Reduced from 240
      canvas.height = 120; // Reduced from 180

      // Initialize hands detector with lower complexity for better performance
      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1, // Lowest complexity for better performance
        minDetectionConfidence: 0.5, // Slightly lowered for smoother tracking
        minTrackingConfidence: 0.5, // Slightly lowered for continuous tracking
      });
      
      // Only set handler after initialization is complete
      hands.onResults(processHandResults);
      
      // Store for later cleanup
      handDetectorRef.current = hands;

      // Create and start camera with even lower resolution for performance
      const camera = new Camera(video, {
        onFrame: async () => {
          if (!mountedRef.current || !handDetectorRef.current) return;
          
          frameSkipCountRef.current = (frameSkipCountRef.current + 1) % (FRAMES_TO_SKIP + 1);
          if (frameSkipCountRef.current !== 0 || processingFrameRef.current) {
            return;
          }
          
          processingFrameRef.current = true;
          try {
            await handDetectorRef.current.send({ image: video });
          } catch (error) {
            console.warn("Hand processing error:", error);
          } finally {
            processingFrameRef.current = false;
          }
        },
        width: 160, // Even lower resolution
        height: 120,
        facingMode: "user"
      });
      
      // Store for later cleanup
      cameraRef.current = camera;
      
      // Start rendering
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(renderFrame);
      
      // Start camera with more resilient approach
      try {
        await camera.start();
        setCameraError(false);
      } catch (err) {
        console.error("Camera start error:", err);
        setCameraError(true);
        
        // Better error recovery: wait and try again once after delay
        if (mountedRef.current) {
          setTimeout(() => {
            if (mountedRef.current && cameraOn) {
              try {
                camera.start().then(() => {
                  setCameraError(false);
                }).catch(e => {
                  console.error("Camera retry failed:", e);
                  setCameraError(true);
                });
              } catch (e) {
                console.error("Camera retry setup failed:", e);
              }
            }
          }, 2000);
        }
      }
    } catch (err) {
      console.error("Camera initialization error:", err);
      setCameraError(true);
    } finally {
      initializingRef.current = false;
    }
  }, [processHandResults, renderFrame]);

  // Main effect for camera initialization
  useEffect(() => {
    mountedRef.current = true;
    
    // Only initialize if camera should be on
    if (cameraOn) {
      initializeCamera();
    } else {
      // Clean up any existing instances
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.warn("Error stopping camera:", e);
        }
        cameraRef.current = null;
      }
      
      if (handDetectorRef.current) {
        try {
          handDetectorRef.current.close();
        } catch (e) {
          console.warn("Error closing hands:", e);
        }
        handDetectorRef.current = null;
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    
    // Clean up old buffers when component re-mounts
    positionBufferRef.current = [];
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.warn("Error stopping camera during cleanup:", e);
        }
      }
      
      if (handDetectorRef.current) {
        try {
          handDetectorRef.current.close();
        } catch (e) {
          console.warn("Error closing hands during cleanup:", e);
        }
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameraOn, initializeCamera]);
  
  // Handle window focus/blur events to manage camera state
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is not visible, pause heavy processing
        if (cameraRef.current) {
          try {
            cameraRef.current.stop();
          } catch (e) {
            console.warn("Error pausing camera:", e);
          }
        }
      } else if (cameraOn && mountedRef.current) {
        // Page became visible again, resume if camera should be on
        initializeCamera();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cameraOn, initializeCamera]);

  return (
    <div className="flex flex-col items-center p-2 space-y-2">
      <video 
        ref={videoRef} 
        className="hidden" 
        playsInline 
        muted 
      />
      <canvas
        ref={canvasRef}
        className="rounded shadow border"
        style={{ 
          width: "240px", 
          height: "180px",
          imageRendering: "pixelated" // Prevent blurry scaling
        }}
      />
      {cameraError && (
        <div className="text-red-500 text-sm">
          Camera error. Try turning it off and on, or check permissions.
        </div>
      )}
      <button
        onClick={() => {
          setCameraOn(prev => !prev);
        }}
        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {cameraOn ? "Turn Camera OFF" : "Turn Camera ON"}
      </button>
    </div>
  );
};

export default GestureDetector;