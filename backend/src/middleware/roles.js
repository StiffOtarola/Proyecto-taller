const JERARQUIA = ['recepcion', 'tecnico', 'jefe_taller', 'admin', 'gerencia'];

// Exige un nivel mínimo según la jerarquía (recepcion < tecnico < jefe_taller < admin < gerencia).
function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    const rolUsuario = req.usuario?.rol;
    const nivelUsuario = JERARQUIA.indexOf(rolUsuario);
    const nivelMinimo = Math.min(...rolesPermitidos.map(r => JERARQUIA.indexOf(r)));

    if (nivelUsuario < nivelMinimo) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

// Exige pertenencia EXACTA a un conjunto de roles (no por jerarquía).
// Útil cuando un rol intermedio NO debe tener un permiso que sí tiene uno inferior:
// p. ej. el técnico no gestiona la agenda, pero la recepción (rol inferior) sí.
function soloRoles(...permitidos) {
  return (req, res, next) => {
    if (!permitidos.includes(req.usuario?.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

module.exports = requireRol;
module.exports.soloRoles = soloRoles;
