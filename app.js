import { h, Component, render } from 'https://unpkg.com/preact@10.19.3/dist/preact.module.js';
import { useState, useEffect } from 'https://unpkg.com/preact@10.19.3/hooks/dist/hooks.module.js';

function App() {
  const [room] = useState(new WebsimSocket());
  const [promptInput, setPromptInput] = useState('');
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New state for tracking different loading/status states
  const [saveStatus, setSaveStatus] = useState({
    isLoading: false,
    message: '',
    type: ''
  });
  const [imageGenerationStatus, setImageGenerationStatus] = useState({
    isLoading: false,
    message: '',
    type: ''
  });
  const [generatedImage, setGeneratedImage] = useState(null);

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
        setSaveStatus({
          isLoading: false,
          message: 'Failed to load prompts. Please try again.',
          type: 'error'
        });
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
        setSaveStatus({
          isLoading: true,
          message: 'Saving prompt...',
          type: 'loading'
        });

        const newPrompt = await room.collection('prompt').create({
          text: promptInput.trim()
        });
        
        setSaveStatus({
          isLoading: false,
          message: 'Prompt saved successfully!',
          type: 'success'
        });
        
        setPromptInput('');

        // Clear status message after 3 seconds
        setTimeout(() => {
          setSaveStatus({
            isLoading: false,
            message: '',
            type: ''
          });
        }, 3000);

      } catch (error) {
        console.error('Error saving prompt:', error);
        setSaveStatus({
          isLoading: false,
          message: 'Failed to save prompt. Please try again.',
          type: 'error'
        });
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
      // Start loading state
      setImageGenerationStatus({
        isLoading: true,
        message: 'Generating image prompt...',
        type: 'loading'
      });

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
      
      // Update status for image generation
      setImageGenerationStatus({
        isLoading: true,
        message: 'Creating image...',
        type: 'loading'
      });

      // Generate image URL
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(data.imagePrompt)}`;
      
      // Update state with new image
      setGeneratedImage({
        url: imageUrl,
        prompt: data.imagePrompt
      });

      // Success status
      setImageGenerationStatus({
        isLoading: false,
        message: 'Image generated successfully!',
        type: 'success'
      });

      // Clear status after 3 seconds
      setTimeout(() => {
        setImageGenerationStatus({
          isLoading: false,
          message: '',
          type: ''
        });
      }, 3000);

    } catch (error) {
      console.error('Error generating image:', error);
      setImageGenerationStatus({
        isLoading: false,
        message: 'Failed to generate image. Please try again.',
        type: 'error'
      });
    }
  };

  return (
    h('div', { className: "prompt-container" },
      h('h1', null, 'Prompt Combiner'),
      
      // Status message for saving prompts
      saveStatus.message && h('div', { 
        className: `status-message ${saveStatus.type}`
      }, 
        saveStatus.isLoading 
          ? h('div', { className: "loading-spinner" }) 
          : null,
        saveStatus.message
      ),

      h('input', { 
        type: "text", 
        value: promptInput,
        onInput: (e) => setPromptInput(e.target.value),
        placeholder: "Enter a new prompt"
      }),
      h('button', { 
        onClick: handleSavePrompt,
        disabled: saveStatus.isLoading
      }, 'Save Prompt'),
      
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
      
      // Status message for image generation
      imageGenerationStatus.message && h('div', { 
        className: `status-message ${imageGenerationStatus.type}`
      }, 
        imageGenerationStatus.isLoading 
          ? h('div', { className: "loading-spinner" }) 
          : null,
        imageGenerationStatus.message
      ),

      h('button', { 
        onClick: combineAndGenerateImage,
        disabled: selectedPrompts.length === 0 || imageGenerationStatus.isLoading
      }, 'Combine and Generate Image'),

      // Conditionally render the generated image
      generatedImage && h('div', { className: "image-container" },
        h('img', {
          src: generatedImage.url,
          alt: generatedImage.prompt,
          id: 'ai-image'
        })
      )
    )
  );
}

render(h(App), document.getElementById('root'));