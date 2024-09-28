/* eslint-disable no-undef */

import { ethers } from 'ethers'
import fetch from 'node-fetch'

const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    }
  }

  try {
    const { content, signature } = JSON.parse(event.body)

    if (!content || !signature) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing content or signature' })
      }
    }

    // Optionally, verify the signature
    const address = ethers.verifyMessage(content, signature)
    console.log(`Verified address: ${address}`)

    // Post the data to the desired endpoint
    const response = await fetch('YOUR_ENDPOINT_URL_HERE', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, signature })
    })

    if (!response.ok) {
      throw new Error('Failed to post data')
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Markdown uploaded successfully' })
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error jjj' })
    }
  }
}

export { handler }
