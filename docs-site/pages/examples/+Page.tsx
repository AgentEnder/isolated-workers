import { useData } from 'vike-react/useData';
import { ExampleCard } from '../../components/ExampleCard';

interface Example {
  id: string;
  title: string;
  description: string;
}

interface Data {
  examples?: Example[];
}

export default function Page() {
  const { examples = [] } = useData<Data>();

  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-gray-100">Examples</h1>
      <p className="text-lg text-gray-400 mb-8">
        Explore examples demonstrating key features of isolated-workers.
      </p>

      <div className="grid gap-6">
        {examples.map((example) => (
          <ExampleCard
            key={example.id}
            id={example.id}
            title={example.title}
            description={example.description}
          />
        ))}
      </div>
    </div>
  );
}
