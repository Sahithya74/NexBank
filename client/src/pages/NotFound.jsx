import Card from '../components/Card';
import Button from '../components/Button';
import { EmptyState } from '../components/States';

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon="search"
        title="This page does not exist"
        text="The page you are looking for may have been moved, or the link may be incorrect."
        action={<Button to="/dashboard" icon="dashboard">Back to dashboard</Button>}
      />
    </Card>
  );
}
