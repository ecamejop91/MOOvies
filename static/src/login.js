document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
      loginError.textContent = 'Username and password are required';
      return;
    }
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        loginError.textContent = data.error || 'Login failed';
        return;
      }
      
      // Redirect to main page on successful login
      window.location.href = '/';
      
    } catch (err) {
      loginError.textContent = 'An error occurred. Please try again.';
      console.error('Login error:', err);
    }
  });
});