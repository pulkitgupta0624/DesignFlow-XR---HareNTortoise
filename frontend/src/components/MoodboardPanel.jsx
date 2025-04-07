import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const UNSPLASH_ACCESS_KEY = 'vOuI192okiXew86U_BevSN75lvus4U3L2xR5ZtClIY8';

const MoodboardPanel = ({ theme, onThemeChange, onImageSelect }) => {
  const [colorPalette, setColorPalette] = useState([]);
  const [images, setImages] = useState([]);
  const [fonts, setFonts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    setIsLoading(true);
    
    let themeColors = [];
    let themeFonts = [];
    
    if (theme === 'minimal') {
      themeColors = ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#BDBDBD', '#212121'];
      themeFonts = ['Inter', 'Roboto', 'Montserrat'];
    } else if (theme === 'bold') {
      themeColors = ['#F44336', '#2196F3', '#FFC107', '#000000', '#FFFFFF'];
      themeFonts = ['Bebas Neue', 'Oswald', 'Montserrat'];
    } else if (theme === 'natural') {
      themeColors = ['#8BC34A', '#795548', '#CDDC39', '#3E2723', '#F1F8E9'];
      themeFonts = ['Playfair Display', 'Merriweather', 'Lora'];
    }

    setColorPalette(themeColors);
    setFonts(themeFonts);

    // Default search when theme changes
    fetchImages('design');
  }, [theme]);

  const fetchImages = async (query) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${query}&per_page=8&client_id=${UNSPLASH_ACCESS_KEY}`
      );
      const data = await response.json();
      const imageData = data.results.map((img) => ({
        url: img.urls.small,
        id: img.id,
        alt: img.alt_description || 'Moodboard image'
      }));
      setImages(imageData);
    } catch (error) {
      console.error('Error fetching Unsplash images:', error);
      // Fallback to mock images if API fails
      const mockImages = [
        'https://source.unsplash.com/random/150x150/?design',
        'https://source.unsplash.com/random/150x150/?art',
        'https://source.unsplash.com/random/150x150/?pattern',
        'https://source.unsplash.com/random/150x150/?texture',
      ].map((url, index) => ({
        url,
        id: `mock-${index}`,
        alt: `Mock image ${index + 1}`
      }));
      setImages(mockImages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchQuery(searchInput);
      fetchImages(searchInput);
    }
  };

  const handleImageClick = (image) => {
    if (onImageSelect) {
      onImageSelect({
        type: 'image',
        url: image.url,
        alt: image.alt
      });
    }
  };

  const handleRefreshImages = () => {
    // Refresh images using current search query or default to theme-related terms
    const query = searchQuery || theme;
    fetchImages(query);
  };

  const handleColorSelect = (color) => {
    // Placeholder for color selection functionality
    console.log('Selected color:', color);
    // Implementation would go here
  };

  const handleFontSelect = (font) => {
    // Placeholder for font selection functionality
    console.log('Selected font:', font);
    // Implementation would go here
  };

  return (
    <motion.div
      initial={{ width: 300, translateX: 0 }}
      animate={{ width: isPanelOpen ? 300 : 50,
        translateX: isPanelOpen ? -70 : 0, // Move left by 20px when open
       }}
      className="bg-white border-l border-gray-200 h-full overflow-hidden flex"
    >
      <motion.button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="h-full w-10 bg-gray-100 flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: isPanelOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </motion.button>

      {isPanelOpen && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3">Theme</h2>
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="minimal">Minimal</option>
              <option value="bold">Bold</option>
              <option value="natural">Natural</option>
            </select>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3">Color Palette</h2>
            {isLoading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="flex space-x-2">
                {colorPalette.map((color, index) => (
                  <div
                    key={index}
                    className="h-8 w-8 rounded-full border border-gray-200 cursor-pointer"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-2">Moodboard</h2>
            <form onSubmit={handleSearch} className="mb-2 flex space-x-2">
              <input
                type="text"
                placeholder="Search images..."
                className="flex-1 p-2 border border-gray-300 rounded"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                type="submit"
                className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Go
              </button>
            </form>

            {isLoading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img) => (
                  <div 
                    key={img.id} 
                    className="bg-gray-100 rounded overflow-hidden cursor-pointer hover:opacity-80"
                    onClick={() => handleImageClick(img)}
                  >
                    <img 
                      src={img.url} 
                      alt={img.alt} 
                      className="w-full h-auto" 
                    />
                  </div>
                ))}
              </div>
            )}
            
            <button 
              onClick={handleRefreshImages}
              className="mt-2 w-full p-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              Refresh Images
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3">Font Suggestions</h2>
            {isLoading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {fonts.map((font, index) => (
                  <div
                    key={index}
                    className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => handleFontSelect(font)}
                  >
                    {font}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MoodboardPanel;