import React, { useState, useEffect } from 'https://unpkg.com/es-react@16.13.1/index.js';
import { render } from 'https://unpkg.com/es-react@16.13.1/dom.js';

function App() {
  const [room] = useState(new WebsimSocket());
  const [promptInput, setPromptInput] = useState('');
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [selectedPrompts, setSelectedPrompts] = useState([]);

  // Load saved prompts on component mount
  useEffect(() => {
    const loadPrompts = async () => {
      const existingPrompts = await room.collection('prompt').getList();
      setSavedPrompts(existingPrompts);
    };
    loadPrompts();
  }, []);

  const handleSavePrompt = async () => {
    if (promptInput.trim()) {
      const newPrompt = await room.collection('prompt').create({
        text: promptInput.trim()
      });
      setSavedPrompts([newPrompt, ...savedPrompts]);
      setPromptInput('');
    }
  };

  const togglePromptSelection = (prompt) => {
    setSelectedPrompts(current => 
      current.includes(prompt) 
        ? current.filter(p => p.id !== prompt.id)
        : [...current, prompt]
    );
  };

  const combineAndGenerateImage = async () => {
    if (selectedPrompts.length === 0) return;

    const combinedPrompt = selectedPrompts.map(p => p.text).join(' + ');

    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: `Generate a descriptive image generation prompt based on: ${combinedPrompt}. 
          Return a single, detailed prompt suitable for image generation.
          
          interface Response {
            imagePrompt: string;
          }
          
          {
            "imagePrompt": "A surreal landscape with floating geometric shapes in pastel colors"
          }
          `,
          data: combinedPrompt
        }),
      });

      const data = await response.json();
      
      // Create and render image
      const imageElement = document.createElement('img');
      imageElement.id = `ai-image-${Date.now()}`;
      imageElement.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(data.imagePrompt)}`;
      imageElement.alt = data.imagePrompt;
      
      // Clear previous images and append new image
      const existingImage = document.getElementById('ai-image');
      if (existingImage) {
        existingImage.remove();
      }
      
      imageElement.id = 'ai-image';
      document.body.appendChild(imageElement);

    } catch (error) {
      console.error('Error generating image:', error);
    }
  };

  return (
    <div className="prompt-container">
      <h1>Prompt Combiner</h1>
      <input 
        type="text" 
        value={promptInput}
        onChange={(e) => setPromptInput(e.target.value)}
        placeholder="Enter a new prompt"
      />
      <button onClick={handleSavePrompt}>Save Prompt</button>
      
      <div className="prompt-list">
        {savedPrompts.map(prompt => (
          <div 
            key={prompt.id} 
            className={`prompt-item ${selectedPrompts.includes(prompt) ? 'selected' : ''}`}
            onClick={() => togglePromptSelection(prompt)}
          >
            {prompt.text}
          </div>
        ))}
      </div>
      
      <button 
        onClick={combineAndGenerateImage}
        disabled={selectedPrompts.length === 0}
      >
        Combine and Generate Image
      </button>
    </div>
  );
}

render(<App />, document.getElementById('root'));