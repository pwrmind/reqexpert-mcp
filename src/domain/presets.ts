import { ExpertRule } from '../core/schema.js';

export const DEFAULT_EXPERT_RULES: ExpertRule[] = [
  {
    id: 'D25',
    name: 'Проверка атомарности требований',
    type: 'Структура',
    description: 'Требование должно быть атомарным (описывать одну функциональность)',
    checkLogic: `function checkRequirement(requirement) {
      const issues = [];
      const title = requirement.title || '';
      const description = requirement.description || '';
      const conjunctions = [' и ', ', а также ', ', также ', ', кроме ', ', плюс ', ' and ', ', and ', ', as well as ', ' as well as ', ', also ', ', plus ', ' plus ', ', besides ', ', in addition to ', ', along with ', ' along with '];
      if (conjunctions.some(c => title.includes(c) || description.includes(c))) {
        issues.push('Требование может быть составным. Разделите на несколько атомарных требований.');
      }
      if (description.split('.').filter(Boolean).length > 3) {
        issues.push('Описание слишком длинное и может содержать несколько функциональностей.');
      }
      return {
        pass: issues.length === 0,
        message: issues.length === 0 ? 'Требование атомарно' : 'Нарушение атомарности',
        issues
      };
    }`,
    example: 'Система должна позволять создавать и редактировать требования',
    strictness: 'high',
    category: 'Качество требований',
    active: true,
  },
  {
    id: 'D26',
    name: 'Проверка неоднозначных терминов',
    type: 'Неоднозначность',
    description: 'Проверка на наличие субъективных и неизмеримых терминов',
    checkLogic: `function checkRequirement(requirement) {
      const issues = [];
      const text = (requirement.title + ' ' + requirement.description).toLowerCase();
      const terms = [
        { term: 'быстро', suggestion: 'Укажите точное время отклика (например, "< 2 сек")' },
        { term: 'удобно', suggestion: 'Укажите метрику UX (например, "не более 3 кликов")' },
        { term: 'иногда', suggestion: 'Укажите точную частоту или условие' },
        { term: 'часто', suggestion: 'Укажите количественный порог' },
        { term: 'простой', suggestion: 'Опишите конкретные шаги сценария' },
        { term: 'легко', suggestion: 'Укажите измеримый критерий освоения' }
      ];
      for (const item of terms) {
        if (text.includes(item.term)) {
          issues.push(\`Неоднозначный термин "\${item.term}". \${item.suggestion}\`);
        }
      }
      return {
        pass: issues.length === 0,
        message: issues.length === 0 ? 'Неоднозначностей не найдено' : \`Найдено терминов: \${issues.length}\`,
        issues
      };
    }`,
    example: 'Система должна работать быстро и удобно',
    strictness: 'medium',
    category: 'Качество требований',
    active: true,
  },
  {
    id: 'H78',
    name: 'Обязательность критериев приемки',
    type: 'Полнота',
    description: 'Требование должно содержать детализированные критерии приемки',
    checkLogic: `function checkRequirement(requirement) {
      const issues = [];
      if (!requirement.acceptanceCriteria || requirement.acceptanceCriteria.trim() === '') {
        issues.push('Отсутствуют критерии приемки (acceptanceCriteria)');
      } else if (requirement.acceptanceCriteria.trim().length < 20) {
        issues.push('Критерии приемки слишком кратки (< 20 символов). Детализируйте условия проверки.');
      }
      return {
        pass: issues.length === 0,
        message: issues.length === 0 ? 'Критерии приемки корректны' : 'Проблемы с критериями приемки',
        issues
      };
    }`,
    example: 'Требование без критериев приемки',
    strictness: 'high',
    category: 'Полнота требований',
    active: true,
  },
  {
    id: 'T01',
    name: 'Трассируемость Must-требований',
    type: 'Трассируемость',
    description:
      'Каждое Must-требование должно иметь хотя бы одну привязку к коду реализации (codeRefs)',
    checkLogic: `function checkRequirement(requirement) {
      const issues = [];
      if (requirement.priority === 'Must') {
        const refs = Array.isArray(requirement.codeRefs) ? requirement.codeRefs : [];
        if (refs.length === 0) {
          issues.push('Must-требование не имеет codeRefs. Укажите путь к файлу реализации через link_code_ref.');
        }
      }
      return {
        pass: issues.length === 0,
        message: issues.length === 0 ? 'Трассируемость в порядке' : 'Нарушена трассируемость',
        issues
      };
    }`,
    example: 'Must-требование без codeRefs',
    strictness: 'high',
    category: 'Трассируемость',
    active: true,
  },
];