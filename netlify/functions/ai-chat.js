import { Buffer } from 'buffer'
import OpenAI from 'openai'
import { encoding_for_model } from 'tiktoken' // Add tiktoken for token counting

const openai = new OpenAI({
  organization: process.env.VITE_ORG_ID,
  project: process.env.VITE_PROJECT_ID,
  apiKey: process.env.VITE_OPENAI_API_KEY
})

const MAX_TOKENS = 32768 // Example: GPT-4o (32k tokens context window)


//const MAX_TOKENS = 4096 // Example: GPT-4 (4k tokens context window)
const MIN_REQUIRED_TOKENS = 2000 // Define a minimum threshold
const MAX_FILE_SIZE = 2 * 1024 * 1024 // Example: 2MB size limit

// Initialize the tokenizer for GPT-4
//const tokenizer = encoding_for_model('gpt-4')
const tokenizer = encoding_for_model('gpt-4o')

// Function to calculate tokens and pad if needed
function padTokensIfNeeded(messages, timelineData) {
  let totalTokens = 0

  // Tokenize the chat history
  messages.forEach((message) => {
    totalTokens += tokenizer.encode(message.content).length
  })

  // Tokenize the timeline data
  const timelineTokens = tokenizer.encode(timelineData)
  totalTokens += timelineTokens.length

  let tokensNeeded = MIN_REQUIRED_TOKENS - totalTokens

  // If more tokens are needed, add padding
  let paddedTimeline = timelineData
  if (tokensNeeded > 0) {
    const paddingText = 'This is padding text. ' // Example padding sentence
    const paddingTokens = tokenizer.encode(paddingText).length

    // Repeat padding text until reaching the desired token count
    while (tokensNeeded > 0) {
      paddedTimeline += paddingText
      tokensNeeded -= paddingTokens
    }
  }

  return paddedTimeline
}

// Function to parse multipart form data
const parseMultipartForm = (event) => {
  const boundary = event.headers['content-type'].split('boundary=')[1]
  let result = { file: null, chatHistory: null }
  try {
    const parts = Buffer.from(event.body, 'base64').toString().split(`--${boundary}`)

    parts.forEach((part) => {
      if (part.includes('filename=')) {
        const filenameMatch = part.match(/filename="(.+)"/)
        if (filenameMatch) {
          const filename = filenameMatch[1]
          const content = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').trim()

          // Check file size during parsing
          const fileSize = Buffer.byteLength(content, 'utf8')
          if (fileSize > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds the allowed limit of ${MAX_FILE_SIZE} bytes`)
          }

          result.file = { filename, content }
        }
      } else if (part.includes('name="chatHistory"')) {
        const content = part.split('\r\n\r\n')[1].trim()
        result.chatHistory = JSON.parse(content)
      }
    })
  } catch (error) {
    throw new Error('Error parsing multipart form: ' + error.message)
  }
  return result
}

const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (
    event.headers['content-type'] &&
    event.headers['content-type'].includes('multipart/form-data')
  ) {
    // Check content-length header before parsing
    const fileSize = parseInt(event.headers['content-length'], 10)
    if (fileSize > MAX_FILE_SIZE) {
      return {
        statusCode: 413,
        body: JSON.stringify({ message: 'File size exceeds the allowed limit of 2MB' })
      }
    }

    try {
      const formData = parseMultipartForm(event)

      if (!formData || !formData.file) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'No file found in form data' })
        }
      }

      const updatedChatHistory = formData.chatHistory || []
      const newItem = {
        role: 'system',
        content: `{ "type":"file", "filename":"${formData.file.filename}", "size":"${fileSize} bytes"}\n${formData.file.content}`
      }
      if (!updatedChatHistory.includes(newItem)) {
        updatedChatHistory.push(newItem)
      }

      // Optionally pad tokens if needed
      const paddedContent = padTokensIfNeeded(updatedChatHistory, formData.file.content)

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Markdown file processed successfully',
          chatHistory: updatedChatHistory,
          paddedContent
        })
      }
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: `Server error: ${error.message}` })
      }
    }
  } else {
    // Handle other POST requests (e.g., chat completions)
    try {
      let { chatHistory, newValue } = JSON.parse(event.body)

      chatHistory.push({
        role: 'user',
        content: newValue
      })

      // Pad timeline data if needed before sending it to OpenAI
      const paddedTimeline = padTokensIfNeeded(chatHistory, newValue)

      const params = {
        messages: chatHistory,
        model: 'gpt-4o'
      }

      const response = await openai.chat.completions.create(params)
      chatHistory.push(response.choices[0].message)

      return {
        statusCode: 200,
        body: JSON.stringify(chatHistory)
      }
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: `Server error: ${error.message}` })
      }
    }
  }
}

export { handler }
