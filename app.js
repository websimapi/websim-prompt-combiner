import { h, Component, render } from 'https://unpkg.com/preact@10.19.3/dist/preact.module.js';
import { useState, useEffect } from 'https://unpkg.com/preact@10.19.3/hooks/dist/hooks.module.js';

function App() {
  const [room] = useState(new WebsimSocket());
  const [promptInput, setPromptInput] = useState('');
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved prompts on component mount with error handling
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        setIsLoading(true);
        const existingPrompts = await room.collection('prompt').getList();
        // Sort prompts by creation date, newest first
        const sortedPrompts = existingPrompts.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        setSavedPrompts(sortedPrompts);
      } catch (error) {
        console.error('Error loading prompts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Initial load
    loadPrompts();

    // Subscribe to changes in prompts collection
    const unsubscribe = room.collection('prompt').subscribe((updatedPrompts) => {
      const sortedPrompts = updatedPrompts.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      setSavedPrompts(sortedPrompts);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  const handleSavePrompt = async () => {
    if (promptInput.trim()) {
      try {
        const newPrompt = await room.collection('prompt').create({
          text: promptInput.trim()
        });
        // No need to manually update savedPrompts due to subscription
        setPromptInput('');
      } catch (error) {
        console.error('Error saving prompt:', error);
      }
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
    h('div', { className: "prompt-container" },
      h('h1', null, 'Prompt Combiner'),
      h('input', { 
        type: "text", 
        value: promptInput,
        onInput: (e) => setPromptInput(e.target.value),
        placeholder: "Enter a new prompt"
      }),
      h('button', { onClick: handleSavePrompt }, 'Save Prompt'),
      
      isLoading 
        ? h('div', null, 'Loading prompts...')
        : h('div', { className: "prompt-list" },
            savedPrompts.length === 0 
              ? h('div', null, 'No saved prompts yet.')
              : savedPrompts.map(prompt => 
                h('div', { 
                  key: prompt.id, 
                  className: `prompt-item ${selectedPrompts.includes(prompt) ? 'selected' : ''}`,
                  onClick: () => togglePromptSelection(prompt)
                }, prompt.text)
              )
          ),
      
      h('button', { 
        onClick: combineAndGenerateImage,
        disabled: selectedPrompts.length === 0
      }, 'Combine and Generate Image')
    )
  );
}

render(h(App), document.getElementById('root'));