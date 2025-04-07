import React from 'react';

const VoiceFeedback = ({ command }) => {
    return (
        <div className="p-2 bg-blue-100 text-blue-800 rounded-md">
            <p>Command: {command}</p>
        </div>
    );
};

export default VoiceFeedback;