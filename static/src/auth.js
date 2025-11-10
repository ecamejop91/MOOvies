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
  signInSuccessUrl: '/',
  callbacks: {
    signInSuccessWithAuthResult: function(authResult, redirectUrl) {
      // User successfully signed in.
      // Return type determines whether we continue the redirect automatically
      // or whether we leave that to developer to handle.
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
    
    // Update UI if needed
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.display = 'none';
    }
  } else {
    // User is signed out
    localStorage.removeItem('authToken');
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
});