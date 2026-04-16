// auth.js
// handles login page logic — sign in and sign up

// tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('auth-tab--active'));
        tab.classList.add('auth-tab--active');

        const target = tab.dataset.tab;
        document.getElementById('signinForm').classList.toggle('hidden', target !== 'signin');
        document.getElementById('signupForm').classList.toggle('hidden', target !== 'signup');
    });
});

// sign in
document.getElementById('signinBtn').addEventListener('click', async () => {
    const email    = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    const errorEl  = document.getElementById('signinError');

    errorEl.classList.add('hidden');

    if (!email || !password) {
        errorEl.textContent = 'Please fill in all fields.';
        errorEl.classList.remove('hidden');
        return;
    }

    const { error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        return;
    }

    // redirect to the main app on success
    window.location.href = 'index.html';
});

// sign up (students only — teachers are created via supabase dashboard)
document.getElementById('signupBtn').addEventListener('click', async () => {
    const name     = document.getElementById('signupName').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorEl  = document.getElementById('signupError');

    errorEl.classList.add('hidden');

    if (!name || !email || !password) {
        errorEl.textContent = 'Please fill in all fields.';
        errorEl.classList.remove('hidden');
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        errorEl.classList.remove('hidden');
        return;
    }

    const { error } = await db.auth.signUp({
        email,
        password,
        options: { data: { display_name: name, role: 'student' } }
    });

    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        return;
    }

    // redirect straight to the app — email confirmation is turned off
    window.location.href = 'index.html';
});