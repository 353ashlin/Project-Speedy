import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from './page'

describe('Home page', () => {
  it('renders the placeholder text', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'Project Speedy' })).toBeInTheDocument()
    expect(screen.getByText('Coming soon.')).toBeInTheDocument()
  })
})
