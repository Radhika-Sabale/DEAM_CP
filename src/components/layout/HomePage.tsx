import type { FC } from 'react';
import { MODULE_REGISTRY } from '../../modules/registry';
import { useUiStore } from '../../store/uiStore';

const numbers = new Map(MODULE_REGISTRY.map((module, index) => [module.id, String(index + 1).padStart(2, '0')]));

export const HomePage: FC = () => {
  const setModule = useUiStore((state) => state.setModule);

  return (
    <section className="home-overview" aria-labelledby="home-title">
      <header className="home-welcome">
        <div>
          <p className="eyebrow">Digital Electronics Lab</p>
          <h1 id="home-title">Choose a workspace</h1>
          <p className="home-description">Continue with a module to explore, design, and analyze digital systems.</p>
        </div>
        <span className="home-module-count">14 modules</span>
      </header>
      <div className="home-module-grid">
        {MODULE_REGISTRY.map((module) => (
          <button
            className="home-module-tile"
            key={module.id}
            type="button"
            onClick={() => setModule(module.id)}
          >
            <span className="home-module-number" aria-hidden="true">{numbers.get(module.id)}</span>
            <span className="home-module-title">{module.title}</span>
            <span className="home-module-description">{module.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
