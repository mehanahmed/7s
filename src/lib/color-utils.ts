export const getContrastTextColor = (hexColor: string): string => {
    try {
        if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 4) return '#FFFFFF'; // Default to white for safety

        let rStr = '0', gStr = '0', bStr = '0';
        if (hexColor.length === 4) {
            rStr = hexColor[1] + hexColor[1];
            gStr = hexColor[2] + hexColor[2];
            bStr = hexColor[3] + hexColor[3];
        } else if (hexColor.length === 7) {
            rStr = hexColor.slice(1, 3);
            gStr = hexColor.slice(3, 5);
            bStr = hexColor.slice(5, 7);
        } else {
            return '#FFFFFF'; // Default for invalid format
        }

        const r = parseInt(rStr, 16);
        const g = parseInt(gStr, 16);
        const b = parseInt(bStr, 16);

        if (isNaN(r) || isNaN(g) || isNaN(b)) return '#FFFFFF'; // Default for parsing error

        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        // Lowered threshold to favor white text on more colors
        return yiq >= 150 ? '#000000' : '#FFFFFF';
    } catch (e) {
        console.error("Error parsing hexColor for contrast:", hexColor, e);
        return '#FFFFFF'; // Default to white on any error
    }
};
