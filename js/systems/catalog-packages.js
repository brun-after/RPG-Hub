// Pacotes de itens embutidos para o modo aventura.
// Cada campanha instala uma cópia isolada; modificar itens numa campanha não afeta outras.

const CATALOG_PACKAGES = [
  // ═══════════════════════════════════════════════════════
  //  PACOTE 1 — ARMAS
  // ═══════════════════════════════════════════════════════
  {
    id: 'armas',
    label: '⚔ Armas',
    descricao: 'Conjunto completo de armas corpo-a-corpo e à distância para todos os estilos de combate.',
    itens: [
      // ── Espadas ──
      { nome: 'Espada Curta', icone: '🗡', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 1,
        atributos_bonus: { Força: 1 }, droppable: true, drop_rate: 20,
        descricao: 'Uma espada leve, ideal para iniciantes. Fácil de manusear.' },

      { nome: 'Espada Longa', icone: '⚔', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 2,
        atributos_bonus: { Força: 2 }, droppable: true, drop_rate: 15,
        descricao: 'Espada de aço forjada com balanço equilibrado. Versátil em combate.' },

      { nome: 'Espada de Batalha', icone: '⚔', tipo_canonico: 'arma', raridade: 'incomum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 4,
        atributos_bonus: { Força: 4, Constituição: 1 }, droppable: true, drop_rate: 10,
        descricao: 'Lâmina robusta usada por soldados veteranos. Concede resistência extra ao portador.' },

      { nome: 'Espadão', icone: '⚔', tipo_canonico: 'arma', raridade: 'incomum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 5,
        atributos_bonus: { Força: 6 }, trade_offs: { Destreza: -2 }, droppable: true, drop_rate: 8,
        descricao: 'Arma de duas mãos que exige força bruta. Letal mas prejudica a agilidade.' },

      { nome: 'Lâmina de Prata', icone: '🗡', tipo_canonico: 'arma', raridade: 'raro',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 6,
        atributos_bonus: { Força: 5, Destreza: 2 }, droppable: false,
        descricao: 'Forjada em prata pura. Eficaz contra mortos-vivos e criaturas das trevas.' },

      { nome: 'Mandoble Élfico', icone: '⚔', tipo_canonico: 'arma', raridade: 'épico',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 8,
        atributos_bonus: { Destreza: 6, Inteligência: 3 }, droppable: false,
        descricao: 'Obra-prima aeriana, incrivelmente leve. Canali magia arcana pelo fio da lâmina.' },

      // ── Machados ──
      { nome: 'Machado de Mão', icone: '🪓', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 1,
        atributos_bonus: { Força: 2 }, droppable: true, drop_rate: 18,
        descricao: 'Machado compacto, bom para golpes rápidos.' },

      { nome: 'Machado de Batalha', icone: '🪓', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 3,
        atributos_bonus: { Força: 3 }, droppable: true, drop_rate: 12,
        descricao: 'Machado pesado com golpe devastador.' },

      { nome: 'Machado de Guerra', icone: '🪓', tipo_canonico: 'arma', raridade: 'incomum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 5,
        atributos_bonus: { Força: 5 }, trade_offs: { Destreza: -1 }, droppable: true, drop_rate: 7,
        descricao: 'Utilizado pelos bárbaros do norte. Seu peso impressiona os inimigos.' },

      // ── Lanças e Polearms ──
      { nome: 'Lança', icone: '🏹', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 1,
        atributos_bonus: { Destreza: 1, Força: 1 }, droppable: true, drop_rate: 15,
        descricao: 'Lança de madeira com ponta de ferro. Boa para manter distância.' },

      { nome: 'Alabarda', icone: '⚔', tipo_canonico: 'arma', raridade: 'incomum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 4,
        atributos_bonus: { Força: 4, Destreza: 1 }, droppable: true, drop_rate: 8,
        descricao: 'Combinação de lança e machado. Versátil e alcança bem.' },

      // ── Armas de Arremesso ──
      { nome: 'Adagas (par)', icone: '🗡', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 1,
        atributos_bonus: { Destreza: 2 }, droppable: true, drop_rate: 20,
        descricao: 'Par de adagas para golpes rápidos e furtivos.' },

      { nome: 'Adaga Envenenada', icone: '🗡', tipo_canonico: 'arma', raridade: 'raro',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 5,
        atributos_bonus: { Destreza: 4 },
        efeitos: [{ tipo: 'debuff', gatilho: 'ao_usar', chance: 40, efeito_aplicado: 'veneno_3t' }],
        droppable: false,
        descricao: 'Lâmina tratada com veneno de aranha. Tem chance de envenenar o alvo.' },

      // ── Arcos e Besteiras ──
      { nome: 'Arco Curto', icone: '🏹', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 1,
        atributos_bonus: { Destreza: 2 }, droppable: true, drop_rate: 15,
        descricao: 'Arco leve para rangers iniciantes. Preciso em curtas distâncias.' },

      { nome: 'Arco Longo', icone: '🏹', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 3,
        atributos_bonus: { Destreza: 3 }, droppable: true, drop_rate: 10,
        descricao: 'Arco de alcance superior. Favorito de batedores e exploradores.' },

      { nome: 'Arco Composto Élfio', icone: '🏹', tipo_canonico: 'arma', raridade: 'raro',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 6,
        atributos_bonus: { Destreza: 6, Sabedoria: 2 }, droppable: false,
        descricao: 'Construído com madeira de teixo e corda de seda mágica. Tiro certeiro.' },

      { nome: 'Besta de Batalha', icone: '🏹', tipo_canonico: 'arma', raridade: 'incomum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'destreza', nivel: 4,
        atributos_bonus: { Destreza: 3, Força: 2 }, droppable: true, drop_rate: 6,
        descricao: 'Besta mecânica de alto impacto. Perfura armaduras leves com facilidade.' },

      // ── Cajados e Varinhas ──
      { nome: 'Cajado de Aprendiz', icone: '🪄', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'inteligencia', nivel: 1,
        atributos_bonus: { Inteligência: 2, Mana: 5 }, droppable: true, drop_rate: 12,
        descricao: 'Cajado de madeira com cristal no topo. Amplifica magia iniciante.' },

      { nome: 'Cajado de Carvalho', icone: '🪄', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'inteligencia', nivel: 3,
        atributos_bonus: { Inteligência: 3, Mana: 10 }, droppable: true, drop_rate: 8,
        descricao: 'Talhado de carvalho ancião. Concentra energia mágica de forma eficiente.' },

      { nome: 'Cajado de Cristal Negro', icone: '🪄', tipo_canonico: 'arma', raridade: 'raro',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'inteligencia', nivel: 6,
        atributos_bonus: { Inteligência: 6, Mana: 20, Sabedoria: 2 }, droppable: false,
        descricao: 'Infundido com obsidiana mágica. Potencializa magias das trevas e de necromancia.' },

      { nome: 'Varinha de Salgueiro', icone: '🪄', tipo_canonico: 'arma', raridade: 'incomum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'sabedoria', nivel: 4,
        atributos_bonus: { Sabedoria: 4, Inteligência: 2 }, droppable: true, drop_rate: 7,
        descricao: 'Varinha da natureza, ideal para druidas e curandeiros.' },

      // ── Armas de Impacto ──
      { nome: 'Maça Simples', icone: '🔨', tipo_canonico: 'arma', raridade: 'comum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 1,
        atributos_bonus: { Força: 2 }, droppable: true, drop_rate: 18,
        descricao: 'Arma de impacto simples. Eficaz contra armaduras pesadas.' },

      { nome: 'Martelo de Guerra', icone: '🔨', tipo_canonico: 'arma', raridade: 'incomum',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'forca', nivel: 4,
        atributos_bonus: { Força: 5, Constituição: 1 }, droppable: true, drop_rate: 8,
        descricao: 'Martelo anão de ferro temperado. Quebra defesas de inimigos encouraçados.' },

      { nome: 'Maça Sagrada', icone: '✝', tipo_canonico: 'arma', raridade: 'raro',
        slot_padrao: 'arma_principal', grupo_atributo_base: 'sabedoria', nivel: 6,
        atributos_bonus: { Sabedoria: 5, Carisma: 2 },
        efeitos: [{ tipo: 'buff', gatilho: 'ao_usar', chance: 25, efeito_aplicado: 'bencao_1t' }],
        droppable: false,
        descricao: 'Abençoada por um alto sacerdote. Tem chance de abençoar o portador ao atacar.' },
    ],
  },

  // ═══════════════════════════════════════════════════════
  //  PACOTE 2 — ARMADURAS E ESCUDOS
  // ═══════════════════════════════════════════════════════
  {
    id: 'armaduras',
    label: '🛡 Armaduras e Escudos',
    descricao: 'Proteções completas: armaduras leves, médias e pesadas, além de escudos de todos os tipos.',
    itens: [
      // ── Armaduras de Couro ──
      { nome: 'Colete de Couro', icone: '🥋', tipo_canonico: 'armadura', raridade: 'comum',
        slot_padrao: 'corpo', nivel: 1,
        atributos_bonus: { Constituição: 1 }, droppable: true, drop_rate: 20,
        descricao: 'Proteção básica de couro curtido. Não atrapalha a movimentação.' },

      { nome: 'Armadura de Couro Reforçado', icone: '🥋', tipo_canonico: 'armadura', raridade: 'comum',
        slot_padrao: 'corpo', nivel: 2,
        atributos_bonus: { Constituição: 2, Destreza: 1 }, droppable: true, drop_rate: 15,
        descricao: 'Couro reforçado com placas de metal nos pontos críticos.' },

      { nome: 'Armadura de Estudioso', icone: '🥋', tipo_canonico: 'armadura', raridade: 'incomum',
        slot_padrao: 'corpo', nivel: 3,
        atributos_bonus: { Inteligência: 2, Mana: 8 }, droppable: true, drop_rate: 10,
        descricao: 'Veste encantada para magos que precisam de mobilidade.' },

      // ── Armaduras de Malha ──
      { nome: 'Cota de Malha', icone: '🪖', tipo_canonico: 'armadura', raridade: 'comum',
        slot_padrao: 'corpo', nivel: 3,
        atributos_bonus: { Constituição: 3 }, droppable: true, drop_rate: 12,
        descricao: 'Malha de ferro entrelaçado. Boa proteção contra golpes cortantes.' },

      { nome: 'Brigandine', icone: '🪖', tipo_canonico: 'armadura', raridade: 'incomum',
        slot_padrao: 'corpo', nivel: 5,
        atributos_bonus: { Constituição: 4, Força: 1 }, droppable: true, drop_rate: 8,
        descricao: 'Colete com placas metálicas costuradas. Equilíbrio entre proteção e leveza.' },

      // ── Armaduras de Placa ──
      { nome: 'Peitoral de Placa', icone: '🛡', tipo_canonico: 'armadura', raridade: 'incomum',
        slot_padrao: 'corpo', nivel: 5,
        atributos_bonus: { Constituição: 5 }, trade_offs: { Destreza: -1 }, droppable: true, drop_rate: 6,
        descricao: 'Placa de aço que cobre o torso. Sólida mas reduz um pouco a agilidade.' },

      { nome: 'Armadura Completa de Cavaleiro', icone: '🛡', tipo_canonico: 'armadura', raridade: 'raro',
        slot_padrao: 'corpo', nivel: 7,
        atributos_bonus: { Constituição: 7, Força: 2 }, trade_offs: { Destreza: -2 }, droppable: false,
        descricao: 'Armadura de placa completa de um cavaleiro de elite. Formidável e intimidadora.' },

      { nome: 'Armadura Arcana', icone: '✨', tipo_canonico: 'armadura', raridade: 'raro',
        slot_padrao: 'corpo', nivel: 6,
        atributos_bonus: { Inteligência: 4, Mana: 20, Constituição: 2 }, droppable: false,
        descricao: 'Veste encantada com runas de proteção. Combina magia e resistência física.' },

      // ── Calças e Perneiras ──
      { nome: 'Calças de Couro', icone: '👖', tipo_canonico: 'calcas', raridade: 'comum',
        slot_padrao: 'pernas', nivel: 1,
        atributos_bonus: { Destreza: 1 }, droppable: true, drop_rate: 20,
        descricao: 'Calças de couro resistentes e confortáveis.' },

      { nome: 'Perneiras de Malha', icone: '👖', tipo_canonico: 'calcas', raridade: 'comum',
        slot_padrao: 'pernas', nivel: 3,
        atributos_bonus: { Constituição: 2 }, droppable: true, drop_rate: 12,
        descricao: 'Proteção de malha para as pernas. Boa resistência a golpes de baixo.' },

      { nome: 'Grevas de Placa', icone: '👖', tipo_canonico: 'calcas', raridade: 'incomum',
        slot_padrao: 'pernas', nivel: 5,
        atributos_bonus: { Constituição: 3, Força: 1 }, droppable: true, drop_rate: 7,
        descricao: 'Perneiras de placa metálica usadas por guerreiros pesados.' },

      // ── Capacetes ──
      { nome: 'Elmo de Couro', icone: '🪖', tipo_canonico: 'capacete', raridade: 'comum',
        slot_padrao: 'cabeca', nivel: 1,
        atributos_bonus: { Constituição: 1 }, droppable: true, drop_rate: 18,
        descricao: 'Capacete simples de couro. Proteção básica para a cabeça.' },

      { nome: 'Elmo de Ferro', icone: '🪖', tipo_canonico: 'capacete', raridade: 'comum',
        slot_padrao: 'cabeca', nivel: 3,
        atributos_bonus: { Constituição: 2 }, droppable: true, drop_rate: 12,
        descricao: 'Capacete de ferro forjado. Robusto e confiável.' },

      { nome: 'Tiara do Sábio', icone: '👑', tipo_canonico: 'capacete', raridade: 'incomum',
        slot_padrao: 'cabeca', nivel: 4,
        atributos_bonus: { Inteligência: 3, Sabedoria: 2 }, droppable: false,
        descricao: 'Tiara encantada que aguça a mente e eleva a percepção mágica.' },

      { nome: 'Capuz do Assassino', icone: '🎭', tipo_canonico: 'capacete', raridade: 'incomum',
        slot_padrao: 'cabeca', nivel: 4,
        atributos_bonus: { Destreza: 3, Carisma: 1 }, droppable: false,
        descricao: 'Capuz que obscurece a identidade e melhora a furtividade.' },

      // ── Botas ──
      { nome: 'Botas de Couro', icone: '👢', tipo_canonico: 'botas', raridade: 'comum',
        slot_padrao: 'pes', nivel: 1,
        atributos_bonus: { Destreza: 1 }, droppable: true, drop_rate: 20,
        descricao: 'Botas de couro resistentes para longas jornadas.' },

      { nome: 'Botas de Ferro', icone: '👢', tipo_canonico: 'botas', raridade: 'comum',
        slot_padrao: 'pes', nivel: 3,
        atributos_bonus: { Constituição: 1, Força: 1 }, droppable: true, drop_rate: 12,
        descricao: 'Botas reforçadas com metal. Bom chute e proteção extra.' },

      { nome: 'Botas Élvicas', icone: '👢', tipo_canonico: 'botas', raridade: 'raro',
        slot_padrao: 'pes', nivel: 6,
        atributos_bonus: { Destreza: 5 }, droppable: false,
        descricao: 'Botas feitas de couro élfio. Praticamente silenciosas ao andar.' },

      // ── Escudos ──
      { nome: 'Escudo de Madeira', icone: '🛡', tipo_canonico: 'escudo', raridade: 'comum',
        slot_padrao: 'arma_secundaria', nivel: 1,
        atributos_bonus: { Constituição: 1 }, droppable: true, drop_rate: 18,
        descricao: 'Escudo simples de madeira reforçada. Proteção básica.' },

      { nome: 'Escudo de Ferro', icone: '🛡', tipo_canonico: 'escudo', raridade: 'comum',
        slot_padrao: 'arma_secundaria', nivel: 2,
        atributos_bonus: { Constituição: 2 }, droppable: true, drop_rate: 14,
        descricao: 'Escudo de ferro batido. Sólido e confiável.' },

      { nome: 'Escudo de Torre', icone: '🛡', tipo_canonico: 'escudo', raridade: 'incomum',
        slot_padrao: 'arma_secundaria', nivel: 5,
        atributos_bonus: { Constituição: 5 }, trade_offs: { Destreza: -1 }, droppable: true, drop_rate: 6,
        descricao: 'Escudo enorme de aço. Cobertura máxima, mas restringe a mobilidade.' },

      { nome: 'Broquel Encantado', icone: '✨', tipo_canonico: 'escudo', raridade: 'raro',
        slot_padrao: 'arma_secundaria', nivel: 6,
        atributos_bonus: { Constituição: 3, Sabedoria: 3 }, droppable: false,
        descricao: 'Pequeno escudo com runas defensivas que absorvem parte da magia inimiga.' },

      // ── Capas ──
      { nome: 'Capa de Viajante', icone: '🧣', tipo_canonico: 'capa', raridade: 'comum',
        slot_padrao: 'capa', nivel: 1,
        atributos_bonus: { Constituição: 1 }, droppable: true, drop_rate: 15,
        descricao: 'Capa grossa e durável. Protege do frio e da chuva.' },

      { nome: 'Capa do Feiticeiro', icone: '🧣', tipo_canonico: 'capa', raridade: 'incomum',
        slot_padrao: 'capa', nivel: 4,
        atributos_bonus: { Inteligência: 2, Mana: 10 }, droppable: false,
        descricao: 'Capa de veludo com bordados arcanos. Favorita de feiticeiros e magos.' },

      { nome: 'Manto das Sombras', icone: '🧣', tipo_canonico: 'capa', raridade: 'raro',
        slot_padrao: 'capa', nivel: 6,
        atributos_bonus: { Destreza: 4, Carisma: 2 }, droppable: false,
        descricao: 'Manto negro que parece absorver a luz. Aumenta a furtividade em ambientes escuros.' },
    ],
  },

  // ═══════════════════════════════════════════════════════
  //  PACOTE 3 — ACESSÓRIOS
  // ═══════════════════════════════════════════════════════
  {
    id: 'acessorios',
    label: '💍 Acessórios',
    descricao: 'Anéis, amuletos e outras joias mágicas que concedem bônus passivos poderosos.',
    itens: [
      // ── Anéis ──
      { nome: 'Anel de Força', icone: '💍', tipo_canonico: 'amuleto', raridade: 'incomum',
        slot_padrao: 'acessorio', nivel: 3,
        atributos_bonus: { Força: 3 }, droppable: false,
        descricao: 'Anel de ouro bruto que aumenta a força física do usuário.' },

      { nome: 'Anel de Proteção', icone: '💍', tipo_canonico: 'amuleto', raridade: 'incomum',
        slot_padrao: 'acessorio', nivel: 3,
        atributos_bonus: { Constituição: 3 }, droppable: false,
        descricao: 'Anel com runa protetora entalhada. Escudo invisível contra danos.' },

      { nome: 'Anel da Velocidade', icone: '💍', tipo_canonico: 'amuleto', raridade: 'incomum',
        slot_padrao: 'acessorio', nivel: 3,
        atributos_bonus: { Destreza: 3 }, droppable: false,
        descricao: 'Anel de prata que parece vibrar. Aumenta a agilidade do portador.' },

      { nome: 'Anel da Mente', icone: '💍', tipo_canonico: 'amuleto', raridade: 'incomum',
        slot_padrao: 'acessorio', nivel: 3,
        atributos_bonus: { Inteligência: 3, Mana: 5 }, droppable: false,
        descricao: 'Anel com gema azul que aguça o intelecto e expande a reserva de mana.' },

      { nome: 'Anel da Sabedoria', icone: '💍', tipo_canonico: 'amuleto', raridade: 'raro',
        slot_padrao: 'acessorio', nivel: 5,
        atributos_bonus: { Sabedoria: 5, Inteligência: 2 }, droppable: false,
        descricao: 'Anel de anciãos. Quem o porta parece ter vivido séculos de experiência.' },

      { nome: 'Anel do Carisma', icone: '💍', tipo_canonico: 'amuleto', raridade: 'incomum',
        slot_padrao: 'acessorio', nivel: 3,
        atributos_bonus: { Carisma: 4 }, droppable: false,
        descricao: 'Anel esculpido com faces sorridentes. Melhora muito a presença social.' },

      { nome: 'Anel de Mana Ampliada', icone: '💎', tipo_canonico: 'amuleto', raridade: 'raro',
        slot_padrao: 'acessorio', nivel: 5,
        atributos_bonus: { Mana: 30, Inteligência: 2 }, droppable: false,
        descricao: 'Anel com cristal mágico que serve como reservatório extra de energia arcana.' },

      { nome: 'Anel do Berserker', icone: '🔴', tipo_canonico: 'amuleto', raridade: 'raro',
        slot_padrao: 'acessorio', nivel: 5,
        atributos_bonus: { Força: 6 }, trade_offs: { Sabedoria: -3 }, droppable: false,
        descricao: 'Anel maldito que amplifica a fúria. Concede poder bruto à custa da razão.' },

      // ── Amuletos ──
      { nome: 'Amuleto de Saúde', icone: '📿', tipo_canonico: 'amuleto', raridade: 'comum',
        slot_padrao: 'acessorio', nivel: 2,
        atributos_bonus: { Constituição: 2 }, droppable: true, drop_rate: 8,
        descricao: 'Amuleto de quartzo rosa. Fortalece a vitalidade do portador.' },

      { nome: 'Colar de Dentes', icone: '🦷', tipo_canonico: 'amuleto', raridade: 'comum',
        slot_padrao: 'acessorio', nivel: 2,
        atributos_bonus: { Força: 2, Constituição: 1 }, droppable: true, drop_rate: 10,
        descricao: 'Feito de dentes de bestas. Símbolo de honra entre tribos bárbaras.' },

      { nome: 'Medalhão Arcano', icone: '📿', tipo_canonico: 'amuleto', raridade: 'incomum',
        slot_padrao: 'acessorio', nivel: 4,
        atributos_bonus: { Inteligência: 3, Mana: 15 }, droppable: false,
        descricao: 'Medalhão com símbolo arcano gravado. Canaliza energia mágica do ambiente.' },

      { nome: 'Símbolo Sagrado', icone: '✝', tipo_canonico: 'amuleto', raridade: 'incomum',
        slot_padrao: 'acessorio', nivel: 3,
        atributos_bonus: { Sabedoria: 4, Carisma: 2 }, droppable: false,
        descricao: 'Símbolo de divindade sagrada. Protege o portador de influências malignas.' },

      { nome: 'Olho de Tigre', icone: '👁', tipo_canonico: 'amuleto', raridade: 'raro',
        slot_padrao: 'acessorio', nivel: 5,
        atributos_bonus: { Destreza: 4, Sabedoria: 3 }, droppable: false,
        descricao: 'Gema natural no formato de olho. Confere percepção aguçada e reflexos rápidos.' },

      { nome: 'Amuleto do Lich', icone: '💀', tipo_canonico: 'amuleto', raridade: 'épico',
        slot_padrao: 'acessorio', nivel: 8,
        atributos_bonus: { Inteligência: 8, Mana: 40 }, trade_offs: { Constituição: -3 },
        efeitos: [{ tipo: 'buff', gatilho: 'ao_usar', chance: 20, efeito_aplicado: 'dreno_vida_1t' }],
        droppable: false,
        descricao: 'Artefato sombrio de um lich antigo. Imenso poder arcano às custas da vitalidade.' },
    ],
  },

  // ═══════════════════════════════════════════════════════
  //  PACOTE 4 — CONSUMÍVEIS
  // ═══════════════════════════════════════════════════════
  {
    id: 'consumiveis',
    label: '🧪 Consumíveis',
    descricao: 'Poções, pergaminhos, alimentos e outros itens de uso único para o campo de batalha.',
    itens: [
      // ── Poções de HP ──
      { nome: 'Poção de Cura Menor', icone: '🧪', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 1, droppable: true, drop_rate: 30,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+15hp' }],
        descricao: 'Líquido vermelho que restaura uma pequena quantidade de saúde.' },

      { nome: 'Poção de Cura', icone: '🧪', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 3, droppable: true, drop_rate: 20,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+35hp' }],
        descricao: 'Mistura herbal potente. Recupera quantidade moderada de vida.' },

      { nome: 'Poção de Cura Maior', icone: '🧪', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 5, droppable: true, drop_rate: 10,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+70hp' }],
        descricao: 'Elaborada por alquimistas experientes. Restauração substancial de saúde.' },

      { nome: 'Elixir Vital', icone: '💊', tipo_canonico: 'consumivel', raridade: 'raro',
        nivel: 7, droppable: false,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+150hp' }],
        descricao: 'Elixir raro de vida concentrada. Restaura grande parte da vitalidade perdida.' },

      // ── Poções de Mana ──
      { nome: 'Poção de Mana Menor', icone: '🔵', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 1, droppable: true, drop_rate: 25,
        efeitos: [{ tipo: 'recurso', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+15mana' }],
        descricao: 'Líquido azul cristalino. Recupera uma quantidade modesta de mana.' },

      { nome: 'Poção de Mana', icone: '🔵', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 3, droppable: true, drop_rate: 15,
        efeitos: [{ tipo: 'recurso', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+35mana' }],
        descricao: 'Concentrado de energia arcana destilada. Restaura mana eficientemente.' },

      { nome: 'Poção de Mana Superior', icone: '💙', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 5, droppable: true, drop_rate: 8,
        efeitos: [{ tipo: 'recurso', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+80mana' }],
        descricao: 'Destilado arcano puro. Restaura amplamente a reserva de mana do feiticeiro.' },

      { nome: 'Éter do Feiticeiro', icone: '✨', tipo_canonico: 'consumivel', raridade: 'raro',
        nivel: 7, droppable: false,
        efeitos: [{ tipo: 'recurso', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+200mana' }],
        descricao: 'Éter mágico puro coletado de linhas de força. Restaura a mana quase por completo.' },

      // ── Poções de Atributo ──
      { nome: 'Poção de Força', icone: '💪', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 3, droppable: true, drop_rate: 10,
        efeitos: [{ tipo: 'atributo', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+4forca_3t' }],
        descricao: 'Filtro de raiz de mandrágora. Concede força sobrenatural por 3 turnos.' },

      { nome: 'Poção de Destreza', icone: '🟢', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 3, droppable: true, drop_rate: 10,
        efeitos: [{ tipo: 'atributo', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+4destreza_3t' }],
        descricao: 'Elixir de mercúrio vegetal. Melhora a velocidade e precisão dos movimentos.' },

      { nome: 'Frasco de Concentração', icone: '🔮', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 4, droppable: true, drop_rate: 8,
        efeitos: [{ tipo: 'atributo', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+5inteligencia_3t' }],
        descricao: 'Fumaça cristalizada de cérebro de grifo. Potencializa o intelecto temporariamente.' },

      // ── Itens de Cura ──
      { nome: 'Ervas Medicinais', icone: '🌿', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 1, droppable: true, drop_rate: 25,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+10hp' }],
        descricao: 'Ervas silvestres com propriedades curativas. Eficácia moderada.' },

      { nome: 'Cataplasma de Raízes', icone: '🌱', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 2, droppable: true, drop_rate: 20,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+20hp' }],
        descricao: 'Pasta de raízes medicinais aplicada sobre ferimentos.' },

      { nome: 'Bandagem Mágica', icone: '🩹', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 4, droppable: true, drop_rate: 8,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+40hp' }],
        descricao: 'Bandagem encantada com fio de seda mágica. Cura rapidamente ferimentos graves.' },

      // ── Antídotos e Remoção de Status ──
      { nome: 'Antídoto', icone: '🟡', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 2, droppable: true, drop_rate: 15,
        efeitos: [{ tipo: 'remover_debuff', gatilho: 'ao_usar', chance: 100, efeito_aplicado: 'veneno' }],
        descricao: 'Neutraliza venenos e toxinas do organismo.' },

      { nome: 'Sal de Purificação', icone: '⚪', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 3, droppable: false,
        efeitos: [{ tipo: 'remover_debuff', gatilho: 'ao_usar', chance: 100, efeito_aplicado: 'todos_debuffs' }],
        descricao: 'Sal abençoado que remove todos os efeitos negativos do corpo e da mente.' },

      // ── Comidas e Bebidas ──
      { nome: 'Ração de Viagem', icone: '🍞', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 1, droppable: false,
        efeitos: [{ tipo: 'hp', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+5hp' }],
        descricao: 'Comida básica de aventureiro. Recupera energia mínima.' },

      { nome: 'Bolo Anão', icone: '🎂', tipo_canonico: 'consumivel', raridade: 'comum',
        nivel: 2, droppable: false,
        efeitos: [{ tipo: 'atributo', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+2constituicao_2t' }],
        descricao: 'Bolo denso e nutritivo dos anões. Concede vigor extra por alguns turnos.' },

      { nome: 'Hidromel Élfico', icone: '🍯', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 3, droppable: false,
        efeitos: [{ tipo: 'atributo', gatilho: 'ao_usar', chance: 100, efeito_aplicado: '+3carisma_3t' }],
        descricao: 'Bebida fermentada dos elfos. Eleva o ânimo e confere eloquência.' },

      // ── Pergaminhos ──
      { nome: 'Pergaminho de Teleporte', icone: '📜', tipo_canonico: 'consumivel', raridade: 'raro',
        nivel: 5, droppable: false,
        efeitos: [{ tipo: 'teleporte', gatilho: 'ao_usar', chance: 100, efeito_aplicado: 'teleporte_livre' }],
        descricao: 'Pergaminho com feitiço de teleporte. Permite mover instantaneamente para um local visível.' },

      { nome: 'Pergaminho de Proteção', icone: '📜', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 3, droppable: true, drop_rate: 5,
        efeitos: [{ tipo: 'buff', gatilho: 'ao_usar', chance: 100, efeito_aplicado: 'escudo_magico_3t' }],
        descricao: 'Cria um escudo mágico que absorve próximos danos por 3 turnos.' },

      { nome: 'Bomba de Fumaça', icone: '💨', tipo_canonico: 'consumivel', raridade: 'incomum',
        nivel: 2, droppable: true, drop_rate: 10,
        efeitos: [{ tipo: 'debuff', gatilho: 'ao_usar', chance: 100, efeito_aplicado: 'cego_2t_area' }],
        descricao: 'Arremessada ao chão libera fumaça densa. Cega inimigos na área por 2 turnos.' },
    ],
  },

  // ═══════════════════════════════════════════════════════
  //  PACOTE 5 — MATERIAIS
  // ═══════════════════════════════════════════════════════
  {
    id: 'materiais',
    label: '⛏ Materiais',
    descricao: 'Ingredientes de crafting, reagentes mágicos, minérios e outros materiais raros.',
    itens: [
      // ── Minérios ──
      { nome: 'Minério de Ferro', icone: '⛏', tipo_canonico: 'material', raridade: 'comum',
        nivel: 1, droppable: true, drop_rate: 30,
        descricao: 'Minério de ferro bruto. Base para forja de armas e armaduras básicas.' },

      { nome: 'Minério de Aço', icone: '⛏', tipo_canonico: 'material', raridade: 'comum',
        nivel: 3, droppable: true, drop_rate: 15,
        descricao: 'Liga metálica resistente. Usado em equipamentos de qualidade intermediária.' },

      { nome: 'Minério de Mitril', icone: '✨', tipo_canonico: 'material', raridade: 'raro',
        nivel: 6, droppable: true, drop_rate: 3,
        descricao: 'Metal élfio de leveza e resistência incomparáveis. Essencial para forja élvica.' },

      { nome: 'Pó de Ouro', icone: '🟡', tipo_canonico: 'material', raridade: 'incomum',
        nivel: 2, droppable: true, drop_rate: 10,
        descricao: 'Ouro refinado em pó fino. Usado em encantamentos e alquimia de alto nível.' },

      // ── Ingredientes Mágicos ──
      { nome: 'Cristal de Mana', icone: '💎', tipo_canonico: 'material', raridade: 'incomum',
        nivel: 3, droppable: true, drop_rate: 10,
        descricao: 'Cristal imbuído com energia arcana. Usado em criação de itens mágicos e poções.' },

      { nome: 'Essência de Fogo', icone: '🔥', tipo_canonico: 'material', raridade: 'incomum',
        nivel: 4, droppable: true, drop_rate: 8,
        descricao: 'Essência condensada do elemento fogo. Ingrediente chave em encantamentos de chamas.' },

      { nome: 'Essência de Gelo', icone: '❄', tipo_canonico: 'material', raridade: 'incomum',
        nivel: 4, droppable: true, drop_rate: 8,
        descricao: 'Cristal de frio eterno. Usado em magia glacial e poções de resistência ao frio.' },

      { nome: 'Essência Sombria', icone: '🌑', tipo_canonico: 'material', raridade: 'raro',
        nivel: 6, droppable: true, drop_rate: 4,
        descricao: 'Fragmento de sombra solidificada. Matéria-prima de magia das trevas.' },

      // ── Orgânicos ──
      { nome: 'Escama de Dragão', icone: '🐉', tipo_canonico: 'material', raridade: 'épico',
        nivel: 8, droppable: true, drop_rate: 1,
        descricao: 'Escama resistente ao fogo de um dragão. Raridade extrema. Base de armaduras lendárias.' },

      { nome: 'Pena de Fênix', icone: '🪶', tipo_canonico: 'material', raridade: 'raro',
        nivel: 6, droppable: true, drop_rate: 2,
        descricao: 'Pena brilhante de fênix. Utilizada em poções de ressurreição e encantamentos de fogo.' },

      { nome: 'Veneno de Aranha', icone: '🕷', tipo_canonico: 'material', raridade: 'comum',
        nivel: 2, droppable: true, drop_rate: 20,
        descricao: 'Veneno extraído de aranha-lobo. Ingrediente para adagas envenenadas e armadilhas.' },

      { nome: 'Olho de Basilisco', icone: '👁', tipo_canonico: 'material', raridade: 'raro',
        nivel: 5, droppable: true, drop_rate: 3,
        descricao: 'Olho petrificante de basilisco, cuidadosamente preservado. Usado em poções de petrificação.' },

      { nome: 'Osso de Morto-Vivo', icone: '💀', tipo_canonico: 'material', raridade: 'comum',
        nivel: 2, droppable: true, drop_rate: 25,
        descricao: 'Fragmento de esqueleto animado. Ingrediente básico de magia necromântica.' },

      { nome: 'Coração de Golem', icone: '🟤', tipo_canonico: 'material', raridade: 'incomum',
        nivel: 4, droppable: true, drop_rate: 8,
        descricao: 'Núcleo mágico de um golem destruído. Fonte de energia para automações e artefatos.' },

      // ── Reagentes Alquímicos ──
      { nome: 'Raiz de Mandrágora', icone: '🌿', tipo_canonico: 'material', raridade: 'comum',
        nivel: 1, droppable: true, drop_rate: 20,
        descricao: 'Raiz medicinal de sabor amargo. Ingrediente base de muitas poções.' },

      { nome: 'Cogumelo Lunar', icone: '🍄', tipo_canonico: 'material', raridade: 'incomum',
        nivel: 3, droppable: true, drop_rate: 10,
        descricao: 'Cogumelo que cresce apenas à luz da lua. Ingrediente de poções de mana e clarividência.' },

      { nome: 'Sangue de Vampiro', icone: '🩸', tipo_canonico: 'material', raridade: 'raro',
        nivel: 5, droppable: true, drop_rate: 4,
        descricao: 'Sangue de vampiro coletado em combate. Usado em rituais sombrios e poções proibidas.' },

      { nome: 'Pó de Diamante', icone: '💠', tipo_canonico: 'material', raridade: 'raro',
        nivel: 6, droppable: false,
        descricao: 'Diamante moído em pó. Usado para encantamentos permanentes de alto nível.' },

      { nome: 'Lã de Ovelha Mágica', icone: '🐑', tipo_canonico: 'material', raridade: 'comum',
        nivel: 1, droppable: false,
        descricao: 'Lã de ovelha criada em ambiente encantado. Boa para confeccionar roupas mágicas básicas.' },

      { nome: 'Madeira de Teixo', icone: '🌲', tipo_canonico: 'material', raridade: 'incomum',
        nivel: 3, droppable: false,
        descricao: 'Madeira rara de teixo ancião. Ideal para arcos e cajados de alta qualidade.' },
    ],
  },
];

// ─── Funções de instalação de pacotes (chamadas por aventura.js) ──────────────
// Expor globalmente para acesso a partir do onclick HTML e de outros módulos.
/* [migração-esm] CATALOG_PACKAGES já exposto pelo rodapé */

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "CATALOG_PACKAGES", { configurable: true, get: () => CATALOG_PACKAGES });
