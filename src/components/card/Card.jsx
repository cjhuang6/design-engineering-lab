import { Button } from '../button/Button.jsx'
import { Switch } from '../switch/Switch.jsx'
import './Card.css'

export function Card({ className, children, ...rest }) {
  const names = ['camellia-card']
  if (className) names.push(className)
  return (
    <div {...rest} className={names.join(' ')}>
      {children}
    </div>
  )
}

export function CardDemo() {
  return (
    <div className="camellia-card-demo">
      <h2>Card</h2>
      <Card>
        <div className="camellia-card-demo-stack">
          <p className="camellia-card-demo-title">Notifications</p>
          <Switch defaultChecked>Email</Switch>
          <Switch>Push</Switch>
          <Button type="button" variant="primary" size="md">Save</Button>
        </div>
      </Card>
    </div>
  )
}
