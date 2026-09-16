const { authenticate, sendAuthError } = require('./_auth');
const { getJsonFile, putJsonFile } = require('./_github');

const PATH = 'employees.json';
const WA_PATH = 'whatsapp-users.json';

function cleanPhone(phone) {
  let value = String(phone || '').replace(/\D/g, '');
  if (value.length === 10) value = '91' + value;
  return value;
}

async function syncWhatsAppUser(employee, remove = false) {
  const waFile = await getJsonFile(WA_PATH);
  const users = { ...(waFile.data?.users || {}) };
  const key = String(employee.id);

  if (remove) {
    delete users[key];
  } else {
    const phone = cleanPhone(employee.phone);
    if (phone) {
      users[key] = { whatsappUserId: phone };
    }
  }

  await putJsonFile(
    WA_PATH,
    { version: 1, users },
    waFile.sha,
    `${remove ? 'Remove' : 'Sync'} WhatsApp employee #${employee.id}`
  );
}

module.exports = async function handler(req, res) {
  try {
    const auth = await authenticate(req);

    const current = await getJsonFile(PATH);
    const employees = Array.isArray(current.data)
      ? current.data
      : (current.data?.employees || []);

    if (req.method === 'GET') {
      return res.status(200).json({
        employees,
        canManageEmployees: !!auth.isAdmin
      });
    }

    if (req.method === 'POST') {
      if (!auth.isAdmin) {
        return res.status(403).json({
          message: 'Administrator access is required to modify employee information.'
        });
      }
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

      const savedEmployee = updated.find(e =>
        Number(e.id) === Number(employee.id) ||
        (
          body.action !== 'update' &&
          String(e.email).toLowerCase() === String(employee.email).toLowerCase()
        )
      );
      if (savedEmployee) {
        await syncWhatsAppUser(savedEmployee);
      }

      return res.status(200).json({ employees: updated });
    }

    if (req.method === 'DELETE') {
      if (!auth.isAdmin) {
        return res.status(403).json({
          message: 'Administrator access is required to modify employee information.'
        });
      }

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

      const removedEmployee = employees.find(e => Number(e.id) === id);
      if (removedEmployee) {
        await syncWhatsAppUser(removedEmployee, true);
      }

      return res.status(200).json({ employees: updated });
    }

    return res.status(405).json({ message: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    if (error.statusCode) return sendAuthError(res, error);
    return res.status(500).json({ message: error.message || 'Employee API failed.' });
  }
};