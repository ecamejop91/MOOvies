// Initialize the FirebaseUI Widget using Firebase
const auth = firebase.auth();
const ui = new firebaseui.auth.AuthUI(firebase.auth());

// FirebaseUI config
const uiConfig = {
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
  ],
  signInFlow: 'popup',
  signInSuccessUrl: '/app',
  callbacks: {
    signInSuccessWithAuthResult: function authSuccess() {
      // Continue with the default redirect behavior to /app.
      return true;
    },
  },
};

// Initialize the FirebaseUI Auth widget
ui.start('#firebaseui-auth-container', uiConfig);

// Handle auth state changes
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Get the ID token
    const idToken = await user.getIdToken();
    // Store it in localStorage for API requests
    localStorage.setItem('authToken', idToken);
    localStorage.setItem('guestMode', 'false');
    if (user.email) {
      localStorage.setItem('userEmail', user.email);
    }
    
    // Update UI if needed
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.display = 'none';
    }
  } else {
    // User is signed out
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
  }
});

// Guest access button
const guestButton = document.getElementById('guestAccessBtn');
if (guestButton) {
  guestButton.addEventListener('click', () => {
    localStorage.setItem('guestMode', 'true');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    window.location.href = '/app';
  });
}
