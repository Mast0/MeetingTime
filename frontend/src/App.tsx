import './App.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Main from './pages/Main'
import ProtectedRoute from './components/ProtectedRoute'
import 'bootstrap/dist/js/bootstrap.bundle.min';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/Base.css';
import CallPage from './pages/CallPage'
import GuestPage from './pages/GuestPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
          <Routes>
            <Route path='/login' element={<Login />} />
            <Route path='/register' element={<Register />} />
            <Route
              path='/'
              element={
                <ProtectedRoute>
                  <Main />
                </ProtectedRoute>
              }
            />
            <Route
              path='call/:roomId'
              element={
                <ProtectedRoute>
                  <CallPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='settings'
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path='guest/call/:roomId' element={<GuestPage />} />
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
