export type UserType = 'AGENCY' | 'INDEPENDENT_OWNER' | 'PLATFORM';
export type PropertyType = 'RESIDENTIAL' | 'COMMERCIAL' | 'RURAL' | 'RURAL_RESIDENCE';
export type PersonType = 'PF' | 'PJ'; // Pessoa Física ou Jurídica

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  type: 'CTR' | 'ACD' | 'VST'; // Contract, Accord, Inspection
  allowedUserTypes: UserType[]; // Who can use this template
  propertyType?: PropertyType;
  landlordType?: PersonType;
  tenantType?: PersonType;
  category: 'ADMINISTRATION' | 'RENTAL' | 'PLATFORM_SERVICE' | 'PARTNERSHIP';
}

// ========================================
// CONTRATO 1: ADMINISTRAÇÃO DE IMÓVEL
// IMOBILIÁRIA / LOCADOR (PF) / LOCATÁRIO
// ========================================

const adminImobiliariaPfLocatario: ContractTemplate = {
  id: "admin-imobiliaria-pf-locatario",
  name: "Administração de Imóvel - Imobiliária / Locador PF / Locatário",
  description: "Contrato de administração de imóvel entre Imobiliária, Locador Pessoa Física e Locatário",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  tenantType: 'PF',
  category: 'ADMINISTRATION',
  content: `CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL — IMOBILIÁRIA / LOCADOR (PESSOA FÍSICA) / LOCATÁRIO

Pelo presente instrumento particular, as partes identificadas abaixo celebram o presente CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL E LOCAÇÃO RESIDENCIAL, que será regido pela legislação aplicável e pelas cláusulas seguintes:

---

I – QUALIFICAÇÃO DAS PARTES

1. IMOBILIÁRIA / ADMINISTRADORA
Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
Nome Fantasia: [IMOBILIARIA_NOME_FANTASIA]
CNPJ: [IMOBILIARIA_CNPJ]
CRECI: [IMOBILIARIA_CRECI]
Endereço Completo: [IMOBILIARIA_ENDERECO]
Representante Legal: [IMOBILIARIA_REPRESENTANTE]
Documento do Representante: [IMOBILIARIA_REP_DOC]
E-mail: [IMOBILIARIA_EMAIL]
Telefone: [IMOBILIARIA_TELEFONE]

2. PROPRIETÁRIO / LOCADOR – PESSOA FÍSICA
Nome Completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado Civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
CPF: [LOCADOR_CPF]
RG: [LOCADOR_RG]
Data de Nascimento: [LOCADOR_DATA_NASC]
Endereço Completo: [LOCADOR_ENDERECO]
E-mail: [LOCADOR_EMAIL]
Telefone: [LOCADOR_TELEFONE]

3. LOCATÁRIO – PESSOA FÍSICA
Nome Completo: [LOCATARIO_NOME]
Nacionalidade: [LOCATARIO_NACIONALIDADE]
Estado Civil: [LOCATARIO_ESTADO_CIVIL]
Profissão: [LOCATARIO_PROFISSAO]
CPF: [LOCATARIO_CPF]
RG: [LOCATARIO_RG]
Data de Nascimento: [LOCATARIO_DATA_NASC]
Endereço Atual: [LOCATARIO_ENDERECO_ATUAL]
E-mail: [LOCATARIO_EMAIL]
Telefone: [LOCATARIO_TELEFONE]

4. IMÓVEL OBJETO
Endereço Completo: [IMOVEL_ENDERECO]
Tipo: [IMOVEL_TIPO]
Matrícula / Registro Imobiliário: [IMOVEL_MATRICULA]
Descrição Complementar: [IMOVEL_DESCRICAO]
Mobílias / Itens inclusos: [IMOVEL_MOVEIS_LISTA]
Padrão de Energia: [IMOVEL_ENERGIA]

---

II – FINALIDADE DO CONTRATO

Este instrumento tem por finalidade:
a) autorizar a IMOBILIÁRIA a administrar o imóvel do LOCADOR;
b) reger a locação residencial entre LOCADOR e LOCATÁRIO;
c) definir responsabilidades, valores, obrigações e procedimentos de vistoria digital.

---

III – VALORES, PAGAMENTOS E REPASSES

1. Valor do Aluguel
O aluguel mensal será de R$ [VALOR_ALUGUEL], com vencimento todo dia [DIA_VENCIMENTO].

2. Reajuste
O aluguel será reajustado anualmente pelo índice [INDICE_REAJUSTE], conforme legislação vigente.

3. Encargos do Locatário
O LOCATÁRIO pagará integralmente:
• consumo de água – [AGUA_RESPONSAVEL]
• consumo de gás – [GAS_RESPONSAVEL]
• energia elétrica – [ENERGIA_RESPONSAVEL]
• condomínio – [CONDOMINIO_RESPONSAVEL]
• IPTU – [IPTU_RESPONSAVEL]
• Seguro incêndio – [SEGURO_INCENDIO_VALOR]

Valores poderão ser atualizados automaticamente no sistema.

4. Taxa de Administração da Imobiliária
A IMOBILIÁRIA receberá [TAXA_ADMINISTRACAO]% sobre o valor mensal do aluguel.

5. Repasse ao Proprietário
Repasses ao LOCADOR ocorrerão até [DIA_REPASSE], descontados:
• taxa de administração
• impostos retidos
• valores de manutenção aprovados
• tarifas e multas pagas pelo sistema

---

IV – GARANTIAS LOCATÍCIAS

Tipo de garantia adotada: [TIPO_GARANTIA]
• Valor da garantia: R$ [VALOR_GARANTIA]
• Dados do fiador, se aplicável: [FIADOR_DADOS]
• Regras de devolução após vistoria final.

---

V – VISTORIAS (DIGITAL E PRESENCIAL)

1. Vistoria Inicial
Será realizada por meio de laudo digital com fotos, vídeos e assinatura eletrônica:
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
O LOCATÁRIO terá 72 horas para contestar o laudo no aplicativo.

2. Vistoria Final
O imóvel deverá ser entregue no mesmo estado em que foi recebido, salvo deterioração natural pelo uso.

3. Avarias
Qualquer dano encontrado será debitado do LOCATÁRIO, podendo o sistema emitir cobrança automática.

---

VI – OBRIGAÇÕES DO LOCADOR

1. Garantir a posse pacífica do imóvel.
2. Entregar o imóvel em condições adequadas de uso.
3. Arcar com reparos estruturais.
4. Informar imediatamente mudanças cadastrais.
5. Pagar impostos e taxas atribuídas ao proprietário, quando não repassadas ao inquilino.

---

VII – OBRIGAÇÕES DO LOCATÁRIO

1. Usar o imóvel somente para fins residenciais.
2. Zelar pela integridade do imóvel e mobiliário.
3. Pagar aluguel e encargos em dia.
4. Permitir vistorias agendadas.
5. Não sublocar sem autorização.
6. Comunicar defeitos estruturais imediatamente.
7. Devolver o imóvel no estado em que recebeu.

---

VIII – OBRIGAÇÕES DA IMOBILIÁRIA

1. Administrar valores, cobranças e repasses.
2. Notificar atrasos e emitir boletos.
3. Realizar vistorias com assinatura digital.
4. Guardar documentos e registros.
5. Informar o LOCADOR sobre manutenções necessárias.
6. Representar o proprietário perante o LOCATÁRIO dentro dos limites deste contrato.

---

IX – MULTAS, ATRASOS E PENALIDADES

• Multa de [MULTA_ATRASO]% sobre o aluguel em atraso.
• Juros de [JUROS_ATRASO]% ao mês.
• Correção monetária conforme índice do aluguel.
• Rescisão antecipada: multa de [VALOR_MULTA_RESCISAO].

---

X – PRAZO DO CONTRATO

Este contrato terá duração de [PRAZO_MESES] meses, iniciando em [DATA_INICIO] e terminando em [DATA_FIM].

Renovações automáticas podem ocorrer conforme regras do sistema e autorização do proprietário.

---

XI – RESCISÃO

Qualquer parte poderá rescindir com aviso prévio de [DIAS_AVISO_PREVIO] dias, exceto por infrações contratuais, que permitem encerramento imediato.

---

XII – LGPD E USO DE DADOS

As partes autorizam o uso dos dados pelo sistema exclusivamente para:
• registros de vistoria
• geração de documentos
• notificações
• pagamentos
• auditoria e segurança

Dados serão armazenados conforme LGPD.

---

XIII – DOCUMENTOS ANEXOS

• Termo de Vistoria Inicial [ANEXO_VISTORIA_INICIAL]
• Termo de Vistoria Final [ANEXO_VISTORIA_FINAL]
• Comprovantes de Garantia [ANEXO_GARANTIA]
• Documentos pessoais digitalizados [ANEXOS_DOCUMENTOS]

---

XIV – FORO

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO] para dirimir conflitos deste contrato.`
};

// ========================================
// CONTRATO 2: ADMINISTRAÇÃO DE IMÓVEL
// (Apenas Imobiliária e Proprietário - Sem Locatário)
// ========================================

const administracaoImovel: ContractTemplate = {
  id: "administracao-imovel",
  name: "Contrato de Administração de Imóvel",
  description: "Contrato de administração entre Imobiliária e Proprietário (sem locatário)",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  category: 'ADMINISTRATION',
  content: `CONTRATO 2 – CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL

────────────────────────────────────────────────────

**IDENTIFICAÇÃO DAS PARTES**

**IMOBILIÁRIA / ADMINISTRADORA**
Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
Nome Fantasia: [IMOBILIARIA_NOME_FANTASIA]
CNPJ: [IMOBILIARIA_CNPJ]
CRECI: [IMOBILIARIA_CRECI]
Endereço Completo: [IMOBILIARIA_ENDERECO]
Representante Legal: [IMOBILIARIA_REPRESENTANTE]
Documento: [IMOBILIARIA_REP_DOC]
Telefone: [IMOBILIARIA_TELEFONE]
E-mail: [IMOBILIARIA_EMAIL]

────────────────────────────────────────────────────

**LOCADOR / PROPRIETÁRIO — PESSOA FÍSICA**
Nome Completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado Civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
CPF: [LOCADOR_CPF]
RG: [LOCADOR_RG]
Data de Nascimento: [LOCADOR_DATA_NASC]
Endereço Completo: [LOCADOR_ENDERECO]
Telefone: [LOCADOR_TELEFONE]
E-mail: [LOCADOR_EMAIL]

────────────────────────────────────────────────────

**IMÓVEL OBJETO DA ADMINISTRAÇÃO**

Endereço Completo: [IMOVEL_ENDERECO]
Tipo: [IMOVEL_TIPO]
Matrícula / Registro: [IMOVEL_MATRICULA]
Área Construída: [IMOVEL_AREA_CONSTRUIDA]
Área Total: [IMOVEL_AREA_TOTAL]
Descrição: [IMOVEL_DESCRICAO]
Mobílias / Itens: [IMOVEL_MOVEIS]
Condomínio: [IMOVEL_CONDOMINIO]
Valor Condomínio: [IMOVEL_CONDOMINIO_VALOR]
IPTU (anual/mensal): [IMOVEL_IPTU_VALOR]

────────────────────────────────────────────────────

**OBJETO DO CONTRATO**

Este contrato tem como objeto:
a) autorizar a IMOBILIÁRIA a administrar o imóvel acima identificado;
b) permitir que a IMOBILIÁRIA realize locação, cobrança, repasse, intermediação e procedimentos administrativos;
c) executar serviços de rotina de administração imobiliária.

────────────────────────────────────────────────────

**PODERES OUTORGADOS À IMOBILIÁRIA**

O LOCADOR autoriza a IMOBILIÁRIA a:
• divulgar o imóvel em plataformas digitais e impressas;
• realizar visitas e agendamentos;
• assinar contrato de locação em nome do LOCADOR, quando autorizado: [AUTORIZA_ASSINATURA_LOCACAO];
• cobrar aluguel, encargos e repasses;
• emitir boletos, notificações e relatórios;
• contratar serviços de manutenção até R$ [VALOR_LIMITE_MANUTENCAO] sem necessidade de prévia autorização;
• intermediar relações com síndico e condomínio;
• realizar vistorias digitalmente.

────────────────────────────────────────────────────

**REMUNERAÇÃO DA IMOBILIÁRIA**

A IMOBILIÁRIA receberá:

Taxa de Administração
Percentual: [TAXA_ADMINISTRACAO]% sobre o valor do aluguel recebido.

Taxa de Intermediação / Locação
Valor fixo: R$ [VALOR_TAXA_INTERMEDIACAO]
ou
Percentual: [TAXA_INTERMEDIACAO_PORCENTAGEM]%

Outras Taxas (se houver)
• emissão de 2ª via de boleto: R$ [VALOR_2VIA]
• relatório especial / laudos adicionais: R$ [VALOR_LAUDO_EXTRA]

Todas as taxas poderão ser atualizadas pelo índice [INDICE_REAJUSTE].

────────────────────────────────────────────────────

**REPASSE E CONTABILIDADE**

Os repasses ao LOCADOR ocorrerão até o dia [DIA_REPASSE], já descontados:
• taxa de administração
• manutenções autorizadas
• impostos
• tarifas bancárias
• valores pagos ao condomínio, se autorizados
• multas ou encargos pagos via sistema

Relatórios serão disponibilizados digitalmente.

────────────────────────────────────────────────────

**VISTORIAS (DIGITAL E PRESENCIAL)**

Vistoria Inicial
Realizada antes da locação.
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
Anexos digitais: [ANEXO_VISTORIA_INICIAL]

Vistoria Final
Realizada após a devolução do imóvel.
Comparação automática com fotos, vídeos e laudo inicial.

────────────────────────────────────────────────────

**OBRIGAÇÕES DO LOCADOR**

O LOCADOR se compromete a:
• entregar o imóvel em condições de uso;
• manter impostos e encargos de responsabilidade do proprietário;
• realizar reparos estruturais;
• informar alterações cadastrais;
• permitir acesso para manutenção e vistoria;
• entregar documentação necessária para locação.

────────────────────────────────────────────────────

**OBRIGAÇÕES DA IMOBILIÁRIA**

A IMOBILIÁRIA deverá:
• administrar o imóvel conforme boas práticas;
• realizar cobranças e intermediações;
• acompanhar pagamentos;
• emitir relatórios periódicos;
• conduzir vistorias;
• atuar com transparência e diligência;
• comunicar ao LOCADOR irregularidades na locação.

────────────────────────────────────────────────────

**RESPONSABILIDADES**

A IMOBILIÁRIA não se responsabiliza por:
• inadimplência do locatário (salvo se contratado plano específico [PLANO_GARANTIA_ALUGUEL]);
• danos causados pelo locatário;
• vícios ocultos no imóvel;
• valores não quitados diretamente pelo LOCADOR.

O LOCADOR autoriza a IMOBILIÁRIA a agir em situações emergenciais com gasto de até R$ [VALOR_EMERGENCIA].

────────────────────────────────────────────────────

**PRAZO**

O presente contrato tem validade de [PRAZO_MESES] meses a partir de [DATA_INICIO], renovando-se automaticamente, salvo manifestação das partes.

────────────────────────────────────────────────────

**RESCISÃO**

Pode haver rescisão:
• por decisão unilateral, com aviso prévio de [DIAS_AVISO_PREVIO] dias;
• por descumprimento contratual, com rescisão imediata;
• por encerramento da atividade da imobiliária.

Multa por rescisão sem aviso prévio: [VALOR_MULTA_RESCISAO]

────────────────────────────────────────────────────

**MULTAS E PENALIDADES**

• Multa de atraso na taxa de administração: [MULTA_ATRASO]%
• Juros: [JUROS_ATRASO]% ao mês
• Atualização monetária pelo índice [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**TRATAMENTO DE DADOS (LGPD)**

A IMOBILIÁRIA poderá armazenar, tratar e compartilhar dados exclusivamente para:
• administração do imóvel
• emissão de documentos
• notificações e cobranças
• integrações com bancos e gateways
• auditorias e segurança

Com base na Lei 13.709/2018.

────────────────────────────────────────────────────

**FORO**

Fica eleito o foro da comarca de [FORO_CIDADE_ESTADO].

────────────────────────────────────────────────────

**ASSINAM DIGITALMENTE**

IMOBILIÁRIA: [IMOBILIARIA_RAZAO_SOCIAL] – [DATA_ASS_IMOBILIARIA]
LOCADOR: [LOCADOR_NOME] – [DATA_ASS_LOCADOR]`
};

// ========================================
// CONTRATO 3: ADMINISTRAÇÃO DE IMÓVEL
// IMOBILIÁRIA / LOCADOR (SEM LOCATÁRIO)
// ========================================

const contratoAdministracaoImovel: ContractTemplate = {
  id: "contrato-administracao-imovel",
  name: "Contrato de Administração de Imóvel",
  description: "Contrato de administração de imóvel entre Imobiliária e Proprietário/Locador",
  type: "CTR",
  allowedUserTypes: ['AGENCY'],
  propertyType: 'RESIDENTIAL',
  landlordType: 'PF',
  category: 'ADMINISTRATION',
  content: `CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL

────────────────────────────────────────────────────

**IDENTIFICAÇÃO DAS PARTES**

────────────────────────────────────────────────────

**IMOBILIÁRIA / ADMINISTRADORA**

Razão Social: [IMOBILIARIA_RAZAO_SOCIAL]
Nome Fantasia: [IMOBILIARIA_NOME_FANTASIA]
CNPJ: [IMOBILIARIA_CNPJ]
CRECI: [IMOBILIARIA_CRECI]
Endereço Completo: [IMOBILIARIA_ENDERECO]
Representante Legal: [IMOBILIARIA_REPRESENTANTE]
Documento: [IMOBILIARIA_REP_DOC]
Telefone: [IMOBILIARIA_TELEFONE]
E-mail: [IMOBILIARIA_EMAIL]

────────────────────────────────────────────────────

**LOCADOR / PROPRIETÁRIO**

Nome Completo: [LOCADOR_NOME]
Nacionalidade: [LOCADOR_NACIONALIDADE]
Estado Civil: [LOCADOR_ESTADO_CIVIL]
Profissão: [LOCADOR_PROFISSAO]
CPF: [LOCADOR_CPF]
RG: [LOCADOR_RG]
Endereço Completo: [LOCADOR_ENDERECO]
Telefone: [LOCADOR_TELEFONE]
E-mail: [LOCADOR_EMAIL]

────────────────────────────────────────────────────

**IMÓVEL OBJETO**

Endereço Completo: [IMOVEL_ENDERECO]
Bairro / Localidade: [IMOVEL_BAIRRO]
Tipo do Imóvel: [IMOVEL_TIPO]
Matrícula / Registro: [IMOVEL_MATRICULA]
Área Total / Construída: [IMOVEL_AREA]
Descrição Complementar: [IMOVEL_DESCRICAO]
Mobílias / Itens: [IMOVEL_MOVEIS]

────────────────────────────────────────────────────

**OBJETO DO CONTRATO**

O LOCADOR confere à IMOBILIÁRIA poderes para:
• administrar o imóvel identificado;
• intermediar contratos de locação;
• promover divulgação para fins de locação;
• cobrar aluguéis e encargos;
• emitir recibos, notificações, boletos e relatórios;
• efetuar repasses financeiros;
• praticar atos necessários para administração rotineira.

────────────────────────────────────────────────────

**PODERES OUTORGADOS À IMOBILIÁRIA**

O LOCADOR autoriza a IMOBILIÁRIA a:
• receber aluguéis, encargos e quaisquer valores;
• promover cobrança amigável;
• aplicar penalidades previstas na Lei 8.245/91;
• contestar inadimplências;
• efetuar e contratar reparos essenciais até [VALOR_LIMITE_MANUTENCAO] sem prévia consulta;
• acompanhar ações condominiais;
• contratar prestadores de serviço quando necessário;
• representar o LOCADOR perante órgãos públicos quando ligado à administração.

────────────────────────────────────────────────────

**TAXA DE ADMINISTRAÇÃO**

O LOCADOR pagará à IMOBILIÁRIA:

Percentual mensal: [TAXA_ADMINISTRACAO]%
Incidência: sobre o valor do aluguel efetivamente recebido.
Possibilidade de atualização monetária: [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**TAXA DE INTERMEDIAÇÃO (LOCAÇÃO)**

A IMOBILIÁRIA fará jus a:
• Valor fixo: [VALOR_TAXA_INTERMEDIACAO], ou
• Percentual: [PERCENTUAL_INTERMEDIACAO]% do primeiro aluguel.

Pago pelo LOCADOR após fechamento da locação.

────────────────────────────────────────────────────

**REPASSES AO LOCADOR**

Os repasses ocorrerão até o dia [DIA_REPASSE], descontados:
• taxa de administração
• taxa de intermediação (quando aplicável)
• manutenções autorizadas
• valores pagos ao condomínio (se autorizado)
• tarifas bancárias
• impostos e tributos retidos

A IMOBILIÁRIA emitirá demonstrativo digital de repasse.

────────────────────────────────────────────────────

**ENCARGOS QUE NÃO SÃO RESPONSABILIDADE DA IMOBILIÁRIA**

A IMOBILIÁRIA não se responsabiliza por:
• inadimplência do locatário (salvo plano contratado: [PLANO_GARANTIA]);
• danos ao imóvel causados por terceiros, vandalismo ou uso indevido;
• vícios ocultos estruturais;
• débitos anteriores à administração;
• pagamento de contas inadimplidas pelo locatário.

────────────────────────────────────────────────────

**OBRIGAÇÕES DO LOCADOR**

O LOCADOR deverá:
• manter IPTU e tributos sob responsabilidade do proprietário;
• providenciar certidões ou documentos necessários;
• permitir entrada para vistorias e reparos;
• autorizar previamente obras não emergenciais;
• garantir condições adequadas de uso para locação;
• comunicar mudanças de dados pessoais e bancários.

────────────────────────────────────────────────────

**OBRIGAÇÕES DA IMOBILIÁRIA**

A IMOBILIÁRIA compromete-se a:
• agir com diligência e transparência;
• administrar o imóvel conforme normas do setor;
• manter registros, recibos, comprovantes e laudos digitais;
• realizar vistoria digital inicial e final;
• comunicar irregularidades ao LOCADOR;
• emitir boletos, recibos, relatórios e notificações;
• promover intermediação profissional entre locador e locatário.

────────────────────────────────────────────────────

**VISTORIAS**

**Vistoria Inicial**
Data: [DATA_VISTORIA_INICIAL]
Responsável: [RESP_VISTORIA_INICIAL]
Laudo: [ANEXO_VISTORIA_INICIAL]

**Vistoria Final**
Comparada com o laudo inicial, considerando desgaste natural.
Laudo: [ANEXO_VISTORIA_FINAL]

────────────────────────────────────────────────────

**RESPONSABILIDADES FINANCEIRAS**

A IMOBILIÁRIA poderá autorizar serviços até [VALOR_LIMITE_SERVICOS].
Valores superiores dependem de autorização do LOCADOR: [MODELO_AUTORIZACAO]

────────────────────────────────────────────────────

**PRAZO DO CONTRATO**

O presente contrato tem validade de [PRAZO_MESES] meses a partir de [DATA_INICIO], renovando-se automaticamente, salvo manifestação das partes com [DIAS_AVISO_PREVIO] dias de antecedência.

────────────────────────────────────────────────────

**RESCISÃO**

A rescisão pode ocorrer:
• por iniciativa de qualquer parte com aviso prévio de [DIAS_AVISO_PREVIO] dias;
• por descumprimento contratual;
• imediatamente em caso de fraude, má-fé ou uso indevido de poderes.

Multa por rescisão sem aviso prévio: [VALOR_MULTA_RESCISAO]

────────────────────────────────────────────────────

**MULTAS E CORREÇÕES**

• Multa: [MULTA_ATRASO]%
• Juros: [JUROS_ATRASO]% ao mês
• Correção: índice [INDICE_REAJUSTE]

────────────────────────────────────────────────────

**TRATAMENTO DE DADOS (LGPD)**

Os dados poderão ser utilizados para:
• administração do imóvel
• emissão de documentos
• segurança e auditorias
• integrações bancárias
• notificações e comunicação

Conforme Lei 13.709/2018.

────────────────────────────────────────────────────

**FORO**

Fica eleito o foro de [FORO_CIDADE_ESTADO].

────────────────────────────────────────────────────

**ASSINAM**

IMOBILIÁRIA: [IMOBILIARIA_RAZAO_SOCIAL] – [DATA_ASS_IMOBILIARIA]
LOCADOR: [LOCADOR_NOME] – [DATA_ASS_LOCADOR]`
};

// ========================================
// EXPORTAÇÃO DOS CONTRATOS
// ========================================

export const contractTemplates: ContractTemplate[] = [
  adminImobiliariaPfLocatario,
  administracaoImovel,
  contratoAdministracaoImovel,
];

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

export const getTemplateById = (id: string): ContractTemplate | undefined => {
  return contractTemplates.find(template => template.id === id);
};

export const getTemplatesByType = (type: 'CTR' | 'ACD' | 'VST'): ContractTemplate[] => {
  return contractTemplates.filter(template => template.type === type);
};

export const getTemplatesByUserType = (userType: UserType): ContractTemplate[] => {
  return contractTemplates.filter(template =>
    template.allowedUserTypes.includes(userType)
  );
};

export const getTemplatesByPropertyType = (propertyType: PropertyType): ContractTemplate[] => {
  return contractTemplates.filter(template =>
    template.propertyType === propertyType
  );
};

export const getTemplatesByCategory = (category: ContractTemplate['category']): ContractTemplate[] => {
  return contractTemplates.filter(template =>
    template.category === category
  );
};

export const getTemplatesForUser = (
  userType: UserType,
  propertyType?: PropertyType,
  category?: ContractTemplate['category']
): ContractTemplate[] => {
  return contractTemplates.filter(template => {
    const matchesUserType = template.allowedUserTypes.includes(userType);
    const matchesPropertyType = !propertyType || template.propertyType === propertyType;
    const matchesCategory = !category || template.category === category;
    return matchesUserType && matchesPropertyType && matchesCategory;
  });
};
