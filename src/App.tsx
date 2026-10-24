import { useState } from 'react'
import React from 'react'
import {createBrowserRouter} from 'react-router-dom'
import { RouterProvider } from 'react-router-dom'

import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <RouterProvider router={createBrowserRouter([])} />
  )
}

export default App
