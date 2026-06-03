const JERARQUIA = ['recepcion', 'tecnico', 'jefe_taller', 'admin', 'gerencia'];

module.exports = function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    const rolUsuario = req.usuario?.rol;
    const nivelUsuario = JERARQUIA.indexOf(rolUsuario);
    const nivelMinimo = Math.min(...rolesPermitidos.map(r => JERARQUIA.indexOf(r)));

    if (nivelUsuario < nivelMinimo) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
};
