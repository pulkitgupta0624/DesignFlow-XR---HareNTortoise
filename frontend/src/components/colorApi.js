export async function getColorPalette(baseColor) {
    try {

        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b];
        };

        const inputRgb = baseColor ? hexToRgb(baseColor) : null;

        const response = await fetch('http://colormind.io/api/', {
            method: 'POST',
            body: JSON.stringify({
                model: "default",
                input: inputRgb ? [inputRgb, "N", "N", "N", "N"] : "N"
            }),
        });

        const data = await response.json();

        // Convert RGB arrays to hex strings
        const palette = data.result.map(color => {
            return `#${color.map(c => c.toString(16).padStart(2, '0')).join('')}`;
        });

        return palette;
    } catch (error) {
        console.error('Error fetching color palette:', error);
        // Fallback palette if API fails
        return [
            '#FF5252', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0',
            '#FF9800', '#607D8B', '#E91E63', '#00BCD4', '#8BC34A'
        ].slice(0, 5);
    }
}