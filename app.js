import { h, Component, render } from 'https://unpkg.com/preact@10.19.3/dist/preact.module.js';
import { useState, useEffect, useRef } from 'https://unpkg.com/preact@10.19.3/hooks/dist/hooks.module.js';

function SaveIcon() {
  return h('svg', { 
    className: 'save-icon', 
    viewBox: "0 0 24 24", 
    fill: "currentColor" 
  }, 
    h('path', { 
      d: "M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" 
    })
  );
}

function App() {
  const [room] = useState(new WebsimSocket());
  const [promptInput, setPromptInput] = useState('');
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const imageRef = useRef(null);
  const imageLoadTimeoutRef = useRef(null);
  
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
  const [imageLoaded, setImageLoaded] = useState(false);

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

  // Updated effect to handle image loading with improved timeout
  useEffect(() => {
    if (generatedImage && imageRef.current) {
      // Reset image loaded state when a new image is set
      setImageLoaded(false);
      
      // Clear any existing timeout
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current);
      }

      // Set a 15-second timeout to wait for image load
      imageLoadTimeoutRef.current = setTimeout(() => {
        if (!imageLoaded) {
          setImageGenerationStatus({
            isLoading: false,
            message: 'Image loading took too long. Please try again.',
            type: 'error'
          });
        }
      }, 15000);
      
      const handleImageLoad = () => {
        // Clear the timeout
        if (imageLoadTimeoutRef.current) {
          clearTimeout(imageLoadTimeoutRef.current);
        }

        setImageLoaded(true);
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
      };

      const handleImageError = () => {
        // Clear the timeout
        if (imageLoadTimeoutRef.current) {
          clearTimeout(imageLoadTimeoutRef.current);
        }

        setImageGenerationStatus({
          isLoading: false,
          message: 'Failed to load image. Please try again.',
          type: 'error'
        });
      };

      const currentImage = imageRef.current;
      currentImage.addEventListener('load', handleImageLoad);
      currentImage.addEventListener('error', handleImageError);

      // Cleanup listeners
      return () => {
        currentImage.removeEventListener('load', handleImageLoad);
        currentImage.removeEventListener('error', handleImageError);
        
        // Clear timeout on cleanup
        if (imageLoadTimeoutRef.current) {
          clearTimeout(imageLoadTimeoutRef.current);
        }
      };
    }
  }, [generatedImage]);

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

    } catch (error) {
      console.error('Error generating image:', error);
      setImageGenerationStatus({
        isLoading: false,
        message: 'Failed to generate image. Please try again.',
        type: 'error'
      });
    }
  };

  const handleSaveImage = async () => {
    if (!generatedImage) return;

    try {
      // Fetch the image blob
      const response = await fetch(generatedImage.url);
      const blob = await response.blob();

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      // Generate filename based on the prompt
      const filename = `generated_image_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      link.download = filename;

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Free up memory
      URL.revokeObjectURL(link.href);

      // Optional: Show success message
      setImageGenerationStatus({
        isLoading: false,
        message: 'Image saved successfully!',
        type: 'success'
      });

      // Clear message after 3 seconds
      setTimeout(() => {
        setImageGenerationStatus({
          isLoading: false,
          message: '',
          type: ''
        });
      }, 3000);

    } catch (error) {
      console.error('Error saving image:', error);
      setImageGenerationStatus({
        isLoading: false,
        message: 'Failed to save image. Please try again.',
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

      // Conditionally render the generated image and save button
      generatedImage && h('div', { 
        className: `image-container ${!imageLoaded ? 'hidden' : ''}` 
      },
        h('img', {
          src: generatedImage.url,
          alt: generatedImage.prompt,
          id: 'ai-image',
          ref: imageRef,
          style: { display: imageLoaded ? 'block' : 'none' }
        }),
        imageLoaded && h('button', { 
          onClick: handleSaveImage,
          className: 'save-image-btn',
          title: 'Save Image to Desktop'
        }, h(SaveIcon))
      )
    )
  );
}

// Ensure the DOM is fully loaded before rendering
document.addEventListener('DOMContentLoaded', () => {
  // Ensure the root element exists before rendering
  const rootElement = document.getElementById('root');
  if (rootElement) {
    render(h(App), rootElement);
  } else {
    console.error('Root element not found');
  }
});