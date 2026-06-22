import React, { useState } from 'react';
import api from '../api';

export default function Login({ onAuthSuccess, switchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Add password validation (6 chars minimum)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onAuthSuccess(user);
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-sm bg-white shadow-lg rounded-xl p-8 border border-gray-100">
        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-800 mb-1 text-center">
          AI Resume Helper
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">Log in to your account</p>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-md px-3 py-2 mb-4 border border-red-100">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-300 disabled:to-indigo-300 text-white text-sm font-medium rounded-lg py-2.5 transition-all shadow-sm hover:shadow-md"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        {/* Register Link */}
        <p className="text-sm text-gray-500 text-center mt-6">
          Don't have an account?{' '}
          <button
            onClick={switchToRegister}
            className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}