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

// redirect to correct page based on role
// teachers → teacher.html, students → index.html
async function redirectAfterAuth() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    window.location.href = profile?.role === 'teacher' ? 'teacher.html' : 'index.html';
}

// sign in
document.getElementById('signinBtn').addEventListener('click', async () => {
    const email    = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    const errorEl  = document.getElementById('signinError');
    const btn      = document.getElementById('signinBtn');

    errorEl.classList.add('hidden');

    if (!email || !password) {
        errorEl.textContent = 'Please fill in all fields.';
        errorEl.classList.remove('hidden');
        return;
    }

    btn.textContent = 'Signing in…';
    btn.disabled    = true;

    const { error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        btn.textContent = 'Sign In';
        btn.disabled    = false;
        return;
    }

    // check role and redirect to the right page
    await redirectAfterAuth();
});

// sign up (students only — teachers are created via supabase dashboard)
document.getElementById('signupBtn').addEventListener('click', async () => {
    const name     = document.getElementById('signupName').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorEl  = document.getElementById('signupError');
    const btn      = document.getElementById('signupBtn');

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

    btn.textContent = 'Creating account…';
    btn.disabled    = true;

    const { error } = await db.auth.signUp({
        email,
        password,
        options: { data: { display_name: name, role: 'student' } }
    });

    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        btn.textContent = 'Create Account';
        btn.disabled    = false;
        return;
    }

    // students always go to index.html
    window.location.href = 'index.html';
});