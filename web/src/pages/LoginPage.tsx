import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { Link, useNavigate } from 'react-router'

import { normalizeError } from '@/api/client'
import { useLogin } from '@/hooks/queries/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Enter a valid email address'),
      password: (v) => (v.length > 0 ? null : 'Enter your password'),
    },
  })

  const error = login.error ? normalizeError(login.error) : null

  return (
    <Center h="100dvh" p="md">
      <Paper withBorder p="xl" w={400} maw="100%">
        <Title order={2} mb="lg">Sign in</Title>

        <form
          onSubmit={form.onSubmit((values) =>
            login.mutate(values, { onSuccess: () => navigate('/') }),
          )}
        >
          <Stack>
            {error && <Alert color="red">{error.message}</Alert>}

            <TextInput label="Email" autoComplete="email" {...form.getInputProps('email')} />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              {...form.getInputProps('password')}
            />

            {/* Spinner inside the button, never a full-screen loader. */}
            <Button type="submit" loading={login.isPending} fullWidth>
              Sign in
            </Button>

            <Button component={Link} to="/register" variant="white">
              Create an account
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
