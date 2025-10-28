export default function TestPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      background: '#0B0F19',
      color: '#F5C742',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>✅ Next.js Funcionando!</h1>
      <p style={{ fontSize: '24px', color: '#9ca3af' }}>Se você vê esta mensagem, o servidor está rodando.</p>
      <p style={{ fontSize: '18px', color: '#6b7280', marginTop: '20px' }}>
        Acesse <a href="/login" style={{ color: '#F5C742', textDecoration: 'underline' }}>/login</a> para testar o sistema
      </p>
    </div>
  );
}
