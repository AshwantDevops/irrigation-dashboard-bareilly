const { authenticate, sendAuthError } = require('./_auth');
const { getJsonFile, putJsonFile } = require('./_github');

const PATH = 'employees.json';

module.exports = async function handler(req, res) {
  try {
    await authenticate(req);

    const current = await getJsonFile(PATH);
    const employees = Array.isArray(current.data)
      ? current.data
      : (current.data?.employees || []);

    if (req.method === 'GET') {
      return res.status(200).json({ employees });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const employee = body.employee || {};

      if (!employee.name || !employee.post || !employee.email || !employee.phone) {
        return res.status(400).json({ message: 'Name, post, email and phone are required.' });
      }

      let updated = [...employees];

      if (body.action === 'update') {
        const index = updated.findIndex(e => Number(e.id) === Number(employee.id));
        if (index < 0) return res.status(404).json({ message: 'Employee not found.' });

        const duplicate = updated.some(
          (e, i) => i !== index &&
            String(e.email || '').toLowerCase() === String(employee.email).toLowerCase()
        );
        if (duplicate) return res.status(409).json({ message: 'Another employee already uses this email.' });

        updated[index] = { ...updated[index], ...employee };
      } else {
        const duplicate = updated.some(
          e => String(e.email || '').toLowerCase() === String(employee.email).toLowerCase()
        );
        if (duplicate) return res.status(409).json({ message: 'Employee with this email already exists.' });

        const id = updated.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;
        updated.push({ id, ...employee });
      }

      await putJsonFile(
        PATH,
        { version: 1, employees: updated },
        current.sha,
        `Update employee information via portal`
      );

      return res.status(200).json({ employees: updated });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      const updated = employees.filter(e => Number(e.id) !== id);

      if (updated.length === employees.length) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      await putJsonFile(
        PATH,
        { version: 1, employees: updated },
        current.sha,
        `Delete employee via portal`
      );

      return res.status(200).json({ employees: updated });
    }

    return res.status(405).json({ message: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    if (error.statusCode) return sendAuthError(res, error);
    return res.status(500).json({ message: error.message || 'Employee API failed.' });
  }
};