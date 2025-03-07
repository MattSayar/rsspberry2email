addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  
  // Get the email from the request
  const email = await request.text()
  
  // Basic email validation
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Invalid email format' 
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Rate limiting using Cloudflare's built-in features
  const ip = request.headers.get('CF-Connecting-IP')
  
  // Implement rate limiting
  const { success } = await checkRateLimit(ip)
  if (!success) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Too many attempts. Please try again later.' 
    }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Check for honeypot field (passed as a header)
  const honeypot = request.headers.get('X-Honeypot')
  if (honeypot && honeypot !== '') {
    // Silently accept but don't process bot submissions
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Subscription received' 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Forward to ntfy.sh with the secret topic
  try {
    // The actual topic would be stored as an environment variable in production
    const SECRET_TOPIC = NTFY_SUBSCRIBE_TOPIC // Set as environment variable in Cloudflare
    
    const ntfyResponse = await fetch(`https://ntfy.sh/${SECRET_TOPIC}`, {
      method: 'POST',
      body: email,
      headers: {
        'Title': 'New Subscription Request',
        'Priority': 'default'
      }
    })
    
    if (ntfyResponse.ok) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Subscription received' 
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Subscription service error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Internal error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Rate limiting implementation using Cloudflare's KV store
async function checkRateLimit(ip) {
  // For a small project, we could use the simplest approach
  const namespace = RATE_LIMIT_NAMESPACE // Set as environment binding in Cloudflare
  const key = `subscribe:${ip}`
  
  // Get current attempts
  const data = await namespace.get(key, { type: 'json' }) || { attempts: 0, timestamp: Date.now() }
  
  // Reset counter if it's been more than an hour
  if (Date.now() - data.timestamp > 3600000) {
    data.attempts = 0
    data.timestamp = Date.now()
  }
  
  // Increment attempts
  data.attempts++
  
  // Store updated value (1 hour TTL)
  await namespace.put(key, JSON.stringify(data), { expirationTtl: 3600 })
  
  // Check if over limit
  return { success: data.attempts <= 5 }
}
