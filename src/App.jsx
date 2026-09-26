import ProfileCard from './components/ProfileCard/ProfileCard'

function App() {
  return (
    <>
      <ProfileCard 
        name="Lizzy"
        role="Real Estate Agent"
        portfolio="ElisabethDavis.net/dufief"
        location="North Potomac"
        buttonLabel="Schedule a Consultation"
      />

      <ProfileCard 
        name="CJ"
        role="Design Engineer"
        portfolio="cj-huang.com"
        location="North Potomac"
        buttonLabel="Schedule an Interview"
      />
    </>
  )
}

export default App