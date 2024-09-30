import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum: ethers.providers.Provider & {
      request: (args: { method: string }) => Promise<any>;
    };
  }
}

async function SignSession(markdownContent: string): Promise<void> {
  let signer: ethers.Signer | null = null;
  const provider = new ethers.providers.Web3Provider(window.ethereum);

  try {
    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    signer = provider.getSigner();

    // Sign the markdown content
    const signature = await signer.signMessage(markdownContent);

    // Prepare the payload
    const payload = {
      content: markdownContent,
      signature: signature,
    };

    // Send the payload to the Netlify function
    const response = await fetch('/.netlify/functions/ether-sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('Markdown uploaded successfully');
    } else {
      console.error('Failed to upload markdown');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

export default SignSession;
