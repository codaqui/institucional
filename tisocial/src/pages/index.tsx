import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import campaigns from '../data/campaigns.json';
import upcoming from '../data/upcoming.json';

export default function Home(): JSX.Element {
  // Calcular totais automaticamente
  const stats = campaigns.reduce((acc, curr) => {
    return {
      totalActions: acc.totalActions + 1,
      peopleImpacted: acc.peopleImpacted + (curr.peopleImpacted || 0),
      animalsImpacted: acc.animalsImpacted + (curr.animalsImpacted || 0),
      totalRaised: acc.totalRaised + (curr.raised || 0),
    };
  }, { totalActions: 0, peopleImpacted: 0, animalsImpacted: 0, totalRaised: 0 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const latestCampaign = campaigns[campaigns.length - 1];

  return (
    <Layout
      title="Tecnologia e Impacto Social"
      description="Tecnologia a serviço do impacto social">
      <header className="hero--tisocial">
        <div className="container">
          <img 
            src="/img/logo.png" 
            alt="TI Social Logo" 
            className="hero__logo"
          />
          <p>Transformando comunidades através da tecnologia.</p>
          <div style={{ marginTop: '2rem' }}>
            <Link className="button--tisocial-outline" to="/campanhas">
              Ver Campanhas
            </Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: '3rem 0' }}>
        <section className="stats-container">
          <div className="stat-item">
            <span className="stat-value">{formatNumber(stats.totalActions)}</span>
            <span className="stat-label">Ações Realizadas</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatNumber(stats.peopleImpacted + stats.animalsImpacted)}</span>
            <span className="stat-label">Vidas Impactadas</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatCurrency(stats.totalRaised)}</span>
            <span className="stat-label">Total Arrecadado</span>
          </div>
        </section>

        <section className="featured-campaign">
          <div className="container">
            <div className="featured-campaign__card">
              <span className="featured-campaign__badge">
                {latestCampaign.isFinalized ? 'Última Campanha' : 'Campanha Atual'}
              </span>
              <h2 className="featured-campaign__title">{latestCampaign.action}: {latestCampaign.isFinalized ? 'Prestação de Contas' : 'Em Andamento'}</h2>
              <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
                {latestCampaign.details || 'Confira os detalhes e o impacto desta nossa ação mais recente.'}
              </p>
              <Link className="button--tisocial-outline" to={`/campanhas/${latestCampaign.slug}`}>
                {latestCampaign.isFinalized ? 'Ler Relatório Completo' : 'Ver Detalhes e Ajudar'}
              </Link>
            </div>
          </div>
        </section>

        <section className="upcoming-section">
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2.5rem' }}>Cronograma 2026</h2>
          <div className="upcoming-grid">
            {upcoming.map((item, idx) => (
              <div key={idx} className="upcoming-item">
                <div className="upcoming-date">{item.date}</div>
                <div className="upcoming-title">{item.action}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="row" style={{ marginTop: '4rem' }}>
          <div className="col col--6">
            <div className="tisocial-card">
              <h3>Nossa Missão</h3>
              <p>Promover a inclusão digital e o desenvolvimento social através de soluções tecnológicas acessíveis.</p>
            </div>
          </div>
          <div className="col col--6">
            <div className="tisocial-card">
              <h3>Como Ajudar</h3>
              <p>Você pode contribuir como voluntário, doador ou parceiro institucional.</p>
              <div style={{ marginTop: '1.5rem' }}>
                <a className="button--tisocial-outline" href="mailto:contato@tisocial.org.br">
                  Entre em Contato
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
