import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { configureAmplify } from './utils/amplifyConfig.ts'

// App のレンダリング前に Amplify Auth を設定する。
configureAmplify()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
