import './ProfileCard.css'

function ProfileCard({name, role, portfolio, location, buttonLabel}){
  return (
    <div className="card">
      <div className="title">
        <h1 className="name">{name}</h1>
        <p className="role">{role}</p>
      </div>

      <hr />

      <div className="information">    
        <div className="info-row">
          <span className="label">Portfolio</span>
          <span className="value">{portfolio}</span>
        </div>
      
        <div className="info-row">
          <span className="label">Location</span>
          <span className="value">{location}</span>
        </div>
      </div>
      
      <button>{buttonLabel}</button>

    </div>
  )
}

export default ProfileCard